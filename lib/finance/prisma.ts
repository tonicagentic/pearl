/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type */
/**
 * Prisma-compatible facade over Drizzle + Pearl's `finance` Postgres schema.
 *
 * Existing call sites keep using `prisma.<model>.<method>(...)`; every call is
 * executed on the transaction opened by `withUserDb` / `withOwnerDb` (RLS needs
 * `app.user_id`), so calling it outside one throws.
 *
 * Supported methods: findMany, findFirst(OrThrow), findUnique(OrThrow), create,
 * createMany, update, updateMany, upsert, delete, deleteMany, count, aggregate,
 * groupBy, plus `$transaction` (array + callback forms; reuses the outer tx).
 *
 * Supported args: where (scalar filters, AND/OR/NOT, relation some/none/every/is/isNot,
 * compound unique keys), orderBy (scalar + to-one relation), select, include (nested,
 * with where/orderBy/take/select/include/_count), take/skip, distinct.
 * Anything else throws a descriptive error rather than silently misbehaving.
 *
 * Behaviour notes:
 * - `userId` is injected on create/createMany/upsert-create from the withUserDb context.
 * - `numeric` columns are returned as JS numbers (null stays null) — the old Float fields.
 * - `PersonalDocument.identifier` / `Vehicle.insurancePolicyNumber` are stored
 *   encrypted in `*Enc` columns; reads expose the last 4 characters on the
 *   legacy field names for UI forms.
 * - NULL ordering mimics SQLite (asc → nulls first, desc → nulls last) to keep UI order.
 */
import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  is,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Column } from "drizzle-orm";
import { alias, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { getDb, getPool, getUserId, serial } from "@/lib/finance/db";
import { encryptSecret, maskSecretLast4 } from "@/lib/finance/crypto";
import {
  FIELD_ALIASES,
  MODEL_TABLES,
  isModelName,
  type ModelName,
} from "@/lib/finance/db-models";
import { RELATIONS, type RelationDef, type RelationTypes } from "@/lib/finance/db-relations";

/** Ciphertext columns that accept plaintext on write and return last-4 on read. */
const SECRET_ENC_FIELDS = new Set([
  "identifierEnc",
  "insurancePolicyNumberEnc",
]);

type Row = Record<string, any>;
type Args = Record<string, any>;
/** Untyped delegate used internally (nested writes). */
type Delegate_ = Record<string, (args?: any) => Promise<any>>;

// ---------------------------------------------------------------------------
// Errors (Prisma-shaped `code` so existing catch blocks keep working)
// ---------------------------------------------------------------------------

export class PrismaShimError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PrismaShimError";
  }
}

function notFound(model: string): PrismaShimError {
  return new PrismaShimError(`No ${model} found`, "P2025");
}

function unsupported(what: string): PrismaShimError {
  return new PrismaShimError(`prisma shim: unsupported ${what}`, "SHIM_UNSUPPORTED");
}

// ---------------------------------------------------------------------------
// Table metadata
// ---------------------------------------------------------------------------

type ColMap = Record<string, PgColumn>;

const metaCache = new Map<
  ModelName,
  {
    table: PgTable;
    columns: ColMap;
    numeric: string[];
    timestamps: Set<string>;
  }
>();

function meta(model: ModelName) {
  let m = metaCache.get(model);
  if (!m) {
    const table = MODEL_TABLES[model] as PgTable;
    const columns: ColMap = {};
    const numeric: string[] = [];
    const timestamps = new Set<string>();
    for (const [key, value] of Object.entries(table)) {
      if (!is(value, Column)) continue;
      columns[key] = value as PgColumn;
      if (value.columnType === "PgNumeric") numeric.push(key);
      if (value.columnType === "PgTimestamp") timestamps.add(key);
    }
    m = { table, columns, numeric, timestamps };
    metaCache.set(model, m);
  }
  return m;
}

function modelOf(name: string): ModelName {
  if (!isModelName(name)) throw unsupported(`model "${name}"`);
  return name;
}

function resolveField(model: ModelName, name: string): string {
  return FIELD_ALIASES[model]?.[name] ?? name;
}

function relationOf(model: ModelName, name: string): RelationDef | undefined {
  return RELATIONS[model]?.[name];
}

let aliasSeq = 0;
function nextAlias(): string {
  aliasSeq = (aliasSeq + 1) % 1_000_000;
  return `r${aliasSeq}`;
}

/** Column accessor that works for real tables and `alias()`ed ones. */
function colOf(tbl: any, name: string): PgColumn | undefined {
  const c = tbl[name];
  return is(c, Column) ? (c as PgColumn) : undefined;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    !(v instanceof Date) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

function toDriverValue(col: PgColumn, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (col.columnType === "PgNumeric" && typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new PrismaShimError(`Non-finite number for numeric column "${col.name}"`);
    }
    return String(value);
  }
  if (col.columnType === "PgTimestamp" && typeof value === "string") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new PrismaShimError(`Invalid date "${value}" for column "${col.name}"`);
    }
    return d;
  }
  return value;
}

function coerceRow(model: ModelName, row: Row): Row {
  const { numeric } = meta(model);
  for (const key of numeric) {
    const v = row[key];
    if (v !== undefined && v !== null) row[key] = Number(v);
  }
  const aliases = FIELD_ALIASES[model];
  if (aliases) {
    for (const [legacy, actual] of Object.entries(aliases)) {
      if (actual in row) {
        row[legacy] = SECRET_ENC_FIELDS.has(actual)
          ? maskSecretLast4(row[actual] as string | null) || null
          : row[actual];
      }
    }
  }
  return row;
}

// ---------------------------------------------------------------------------
// where
// ---------------------------------------------------------------------------

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function andAll(parts: (SQL | undefined)[]): SQL | undefined {
  const defined = parts.filter((p): p is SQL => p !== undefined);
  if (defined.length === 0) return undefined;
  return defined.length === 1 ? defined[0] : and(...defined);
}

function buildColumnFilter(
  col: PgColumn,
  value: any,
  path: string,
): SQL | undefined {
  if (value === undefined) return undefined;
  if (value === null) return isNull(col);
  if (!isPlainObject(value)) {
    return eq(col, toDriverValue(col, value));
  }

  const parts: (SQL | undefined)[] = [];
  // `mode` is ignored: LIKE filters are always case-insensitive (SQLite parity).
  for (const [op, raw] of Object.entries(value)) {
    if (raw === undefined || op === "mode") continue;
    switch (op) {
      case "equals":
        parts.push(raw === null ? isNull(col) : eq(col, toDriverValue(col, raw)));
        break;
      case "not":
        if (raw === null) parts.push(isNotNull(col));
        else if (isPlainObject(raw)) {
          const inner = buildColumnFilter(col, raw, path);
          if (inner) parts.push(not(inner));
        } else parts.push(ne(col, toDriverValue(col, raw)));
        break;
      case "in":
        parts.push(inArray(col, (raw as unknown[]).map((v) => toDriverValue(col, v))));
        break;
      case "notIn":
        parts.push(notInArray(col, (raw as unknown[]).map((v) => toDriverValue(col, v))));
        break;
      case "lt":
        parts.push(lt(col, toDriverValue(col, raw)));
        break;
      case "lte":
        parts.push(lte(col, toDriverValue(col, raw)));
        break;
      case "gt":
        parts.push(gt(col, toDriverValue(col, raw)));
        break;
      case "gte":
        parts.push(gte(col, toDriverValue(col, raw)));
        break;
      case "contains":
        parts.push(ilike(col, `%${escapeLike(String(raw))}%`));
        break;
      case "startsWith":
        parts.push(ilike(col, `${escapeLike(String(raw))}%`));
        break;
      case "endsWith":
        parts.push(ilike(col, `%${escapeLike(String(raw))}`));
        break;
      default:
        throw unsupported(`filter operator "${op}" on ${path}`);
    }
  }
  return andAll(parts);
}

function buildWhere(model: ModelName, tbl: any, where: any): SQL | undefined {
  if (where === undefined || where === null) return undefined;
  if (!isPlainObject(where)) throw unsupported(`where clause on ${model}`);

  const parts: (SQL | undefined)[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if (key === "AND") {
      const list = Array.isArray(value) ? value : [value];
      parts.push(andAll(list.map((w) => buildWhere(model, tbl, w))));
      continue;
    }
    if (key === "OR") {
      const list = (Array.isArray(value) ? value : [value]) as any[];
      if (list.length === 0) {
        parts.push(sql`false`);
        continue;
      }
      const built = list.map((w) => buildWhere(model, tbl, w) ?? sql`true`);
      parts.push(built.length === 1 ? built[0] : or(...built));
      continue;
    }
    if (key === "NOT") {
      const list = Array.isArray(value) ? value : [value];
      for (const w of list) {
        const inner = buildWhere(model, tbl, w);
        if (inner) parts.push(not(inner));
      }
      continue;
    }

    const rel = relationOf(model, key);
    if (rel) {
      parts.push(buildRelationFilter(model, tbl, key, rel, value));
      continue;
    }

    const field = resolveField(model, key);
    const col = colOf(tbl, field);
    if (col) {
      parts.push(buildColumnFilter(col, value, `${model}.${key}`));
      continue;
    }

    // Prisma compound unique key, e.g. { year_month: { year, month } }
    if (key.includes("_") && isPlainObject(value)) {
      parts.push(buildWhere(model, tbl, value));
      continue;
    }

    throw unsupported(`where field "${key}" on ${model}`);
  }
  return andAll(parts);
}

function buildRelationFilter(
  model: ModelName,
  tbl: any,
  relName: string,
  rel: RelationDef,
  value: any,
): SQL | undefined {
  const targetModel = modelOf(rel.target);
  const { table } = meta(targetModel);

  /** exists (select 1 from target a where link [and sub-filter]) */
  const existsWith = (sub: any, negateSub = false): SQL => {
    const a = nextAlias();
    const aliased = alias(table, a);
    const link = eq(colOf(aliased, rel.foreign)!, colOf(tbl, rel.local)!);
    let inner = buildWhere(targetModel, aliased, sub);
    if (inner && negateSub) inner = not(inner);
    const cond = inner ? and(link, inner)! : link;
    return sql`exists (select 1 from ${table} as ${sql.identifier(a)} where ${cond})`;
  };
  const notExistsWith = (sub: any): SQL => sql`not ${existsWith(sub)}`;

  if (rel.kind === "many") {
    if (!isPlainObject(value)) throw unsupported(`filter on list relation ${model}.${relName}`);
    const parts: (SQL | undefined)[] = [];
    for (const [op, sub] of Object.entries(value)) {
      if (sub === undefined) continue;
      if (op === "some") parts.push(existsWith(sub));
      else if (op === "none") parts.push(notExistsWith(sub));
      else if (op === "every") parts.push(sql`not ${existsWith(sub, true)}`);
      else throw unsupported(`relation filter "${op}" on ${model}.${relName}`);
    }
    return andAll(parts);
  }

  // to-one relation
  if (value === null) return notExistsWith({});
  if (!isPlainObject(value)) throw unsupported(`filter on relation ${model}.${relName}`);
  const keys = Object.keys(value);
  if (keys.length > 0 && keys.every((k) => k === "is" || k === "isNot")) {
    const parts: (SQL | undefined)[] = [];
    if ("is" in value && value.is !== undefined) {
      parts.push(value.is === null ? notExistsWith({}) : existsWith(value.is));
    }
    if ("isNot" in value && value.isNot !== undefined) {
      parts.push(value.isNot === null ? existsWith({}) : notExistsWith(value.isNot));
    }
    return andAll(parts);
  }
  return existsWith(value);
}

// ---------------------------------------------------------------------------
// orderBy
// ---------------------------------------------------------------------------

function orderExprs(model: ModelName, tbl: any, orderBy: any): SQL[] {
  if (!orderBy) return [];
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const out: SQL[] = [];
  for (const entry of list) {
    if (!isPlainObject(entry)) throw unsupported(`orderBy on ${model}`);
    for (const [key, dir] of Object.entries(entry)) {
      if (dir === undefined) continue;
      out.push(...orderEntry(model, tbl, key, dir));
    }
  }
  return out;
}

function orderEntry(model: ModelName, tbl: any, key: string, dir: any): SQL[] {
  const rel = relationOf(model, key);
  if (rel) {
    if (rel.kind !== "one" || !isPlainObject(dir)) {
      throw unsupported(`orderBy on list relation ${model}.${key}`);
    }
    const targetModel = modelOf(rel.target);
    const { table } = meta(targetModel);
    const out: SQL[] = [];
    for (const [innerKey, innerDir] of Object.entries(dir)) {
      const a = nextAlias();
      const aliased = alias(table, a);
      // One level of scalar ordering through a to-one relation (correlated subquery).
      const sort = (innerDir as any) === "desc" ? "desc" : "asc";
      const innerCol = colOf(aliased, resolveField(targetModel, innerKey));
      if (!innerCol) throw unsupported(`nested orderBy ${model}.${key}.${innerKey}`);
      const link = eq(colOf(aliased, rel.foreign)!, colOf(tbl, rel.local)!);
      const subquery = sql`(select ${innerCol} from ${table} as ${sql.identifier(a)} where ${link} limit 1)`;
      out.push(
        sort === "desc"
          ? sql`${subquery} desc nulls last`
          : sql`${subquery} asc nulls first`,
      );
    }
    return out;
  }

  const col = colOf(tbl, resolveField(model, key));
  if (!col) throw unsupported(`orderBy field "${key}" on ${model}`);
  let direction: "asc" | "desc";
  let nulls: "first" | "last" | undefined;
  if (isPlainObject(dir)) {
    direction = dir.sort === "desc" ? "desc" : "asc";
    nulls = dir.nulls === "first" || dir.nulls === "last" ? dir.nulls : undefined;
  } else {
    direction = dir === "desc" ? "desc" : "asc";
  }
  nulls ??= direction === "asc" ? "first" : "last";
  if (col.notNull) nulls = undefined; // irrelevant; keep plans simple
  const suffix = nulls ? sql` nulls ${sql.raw(nulls)}` : sql``;
  return [sql`${col} ${sql.raw(direction)}${suffix}`];
}

// ---------------------------------------------------------------------------
// Reads (select / include loader)
// ---------------------------------------------------------------------------

type Projection = {
  /** scalar columns requested by the caller */
  selected: Set<string> | "all";
  /** relation name -> args for nested load (true => {}) */
  relations: Map<string, Args>;
  countSelect: Record<string, any> | null;
};

function parseProjection(model: ModelName, args: Args): Projection {
  const relations = new Map<string, Args>();
  let countSelect: Record<string, any> | null = null;
  const take = (name: string, v: any) => {
    if (v === undefined || v === false) return;
    if (name === "_count") {
      countSelect = v === true ? {} : (v.select ?? {});
      return;
    }
    if (!relationOf(model, name)) {
      throw unsupported(`include/select relation "${name}" on ${model}`);
    }
    relations.set(name, v === true ? {} : v);
  };

  if (args.select) {
    const selected = new Set<string>();
    for (const [name, v] of Object.entries(args.select)) {
      if (v === undefined || v === false) continue;
      if (name === "_count" || relationOf(model, name)) {
        take(name, v);
      } else {
        const col = resolveField(model, name);
        if (!meta(model).columns[col]) {
          throw unsupported(`select field "${name}" on ${model}`);
        }
        selected.add(col);
      }
    }
    return { selected, relations, countSelect };
  }

  if (args.include) {
    for (const [name, v] of Object.entries(args.include)) take(name, v);
  }
  return { selected: "all", relations, countSelect };
}

function isSelected(proj: Projection, col: string): boolean {
  return proj.selected === "all" || proj.selected.has(col);
}

async function runFind(
  model: ModelName,
  args: Args,
  /** extra columns the caller needs present on every row (not stripped here) */
  needKeys: string[] = [],
): Promise<Row[]> {
  if (args.cursor !== undefined) throw unsupported("cursor pagination");
  const { table, columns } = meta(model);
  const proj = parseProjection(model, args);

  // columns to fetch
  const fetch = new Set<string>();
  if (proj.selected === "all") {
    for (const k of Object.keys(columns)) fetch.add(k);
  } else {
    for (const k of proj.selected) fetch.add(k);
  }
  const relKeys: string[] = [];
  for (const name of proj.relations.keys()) relKeys.push(relationOf(model, name)!.local);
  if (proj.countSelect) {
    for (const name of Object.keys(proj.countSelect)) {
      const rel = relationOf(model, name);
      if (!rel) throw unsupported(`_count relation "${name}" on ${model}`);
      relKeys.push(rel.local);
    }
  }
  const distinct: string[] = (
    args.distinct ? (Array.isArray(args.distinct) ? args.distinct : [args.distinct]) : []
  ).map((f: string) => resolveField(model, f));
  for (const k of [...needKeys, ...relKeys, ...distinct]) fetch.add(k);

  const projection: Record<string, PgColumn> = {};
  for (const k of fetch) {
    const c = columns[k];
    if (!c) throw unsupported(`column "${k}" on ${model}`);
    projection[k] = c;
  }

  const db = getDb();
  let q: any = db
    .select(projection)
    .from(table)
    .where(buildWhere(model, table, args.where));
  const order = orderExprs(model, table, args.orderBy);
  if (order.length) q = q.orderBy(...order);
  const inMemoryPaging = distinct.length > 0;
  if (!inMemoryPaging) {
    if (args.take !== undefined && args.take < 0) throw unsupported("negative take");
    if (args.take !== undefined) q = q.limit(args.take);
    if (args.skip) q = q.offset(args.skip);
  }

  let rows: Row[] = await serial(() => q);

  if (inMemoryPaging) {
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = JSON.stringify(distinct.map((d) => r[d]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skip = args.skip ?? 0;
    rows = rows.slice(skip, args.take !== undefined ? skip + args.take : undefined);
  }

  for (const r of rows) coerceRow(model, r);

  await attachRelations(model, rows, proj);

  // strip helper columns we only fetched for joins / distinct
  const keep = new Set<string>([...needKeys]);
  const strip = [...fetch].filter((k) => !isSelected(proj, k) && !keep.has(k));
  if (strip.length) {
    for (const r of rows) for (const k of strip) delete r[k];
  }
  return rows;
}

async function attachRelations(
  model: ModelName,
  rows: Row[],
  proj: Projection,
): Promise<void> {
  if (rows.length === 0) return;

  for (const [name, nestedArgs] of proj.relations) {
    const rel = relationOf(model, name)!;
    const targetModel = modelOf(rel.target);
    const keys = [...new Set(rows.map((r) => r[rel.local]).filter((v) => v != null))];

    const grouped = new Map<unknown, Row[]>();
    let nestedRows: Row[] = [];
    if (keys.length > 0) {
      const nestedSelectCols = nestedArgs.select
        ? !!nestedArgs.select[rel.foreign]
        : true;
      nestedRows = await runFind(
        targetModel,
        {
          ...nestedArgs,
          where: nestedArgs.where
            ? { AND: [nestedArgs.where, { [rel.foreign]: { in: keys } }] }
            : { [rel.foreign]: { in: keys } },
          // take/skip are per-parent: applied after grouping
          take: undefined,
          skip: undefined,
        },
        [rel.foreign],
      );
      for (const n of nestedRows) {
        const k = n[rel.foreign];
        const bucket = grouped.get(k);
        if (bucket) bucket.push(n);
        else grouped.set(k, [n]);
      }
      if (!nestedSelectCols) {
        for (const n of nestedRows) delete n[rel.foreign];
      }
    }

    for (const r of rows) {
      const list = grouped.get(r[rel.local]) ?? [];
      if (rel.kind === "many") {
        const skip = nestedArgs.skip ?? 0;
        r[name] =
          nestedArgs.take !== undefined || skip
            ? list.slice(skip, nestedArgs.take !== undefined ? skip + nestedArgs.take : undefined)
            : list;
      } else {
        r[name] = list[0] ?? null;
      }
    }
  }

  if (proj.countSelect) {
    for (const r of rows) r._count = {};
    for (const [name, spec] of Object.entries(proj.countSelect)) {
      const rel = relationOf(model, name)!;
      const targetModel = modelOf(rel.target);
      const { table, columns } = meta(targetModel);
      const keys = [...new Set(rows.map((r) => r[rel.local]).filter((v) => v != null))];
      const counts = new Map<unknown, number>();
      if (keys.length > 0) {
        const foreignCol = columns[rel.foreign]!;
        const extra = isPlainObject(spec) ? buildWhere(targetModel, table, spec.where) : undefined;
        const res: Row[] = await serial(() =>
          getDb()
            .select({ key: foreignCol, n: sql<number>`count(*)` })
            .from(table)
            .where(andAll([inArray(foreignCol, keys), extra]))
            .groupBy(foreignCol),
        );
        for (const g of res) counts.set(g.key, Number(g.n));
      }
      for (const r of rows) r._count[name] = counts.get(r[rel.local]) ?? 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function buildValues(
  model: ModelName,
  data: Row,
  opts: { injectUser: boolean; forUpdate: boolean },
): Row {
  const { columns } = meta(model);
  const out: Row = {};
  for (const [key, raw] of Object.entries(data)) {
    if (raw === undefined) continue;
    const field = resolveField(model, key);
    const col = columns[field];
    if (!col) {
      if (relationOf(model, key)) {
        throw unsupported(`nested relation write "${key}" on ${model} (set the foreign key instead)`);
      }
      throw unsupported(`data field "${key}" on ${model}`);
    }
    if (field === "userId" && opts.forUpdate) continue;

    if (isPlainObject(raw) && opts.forUpdate) {
      const ops = Object.keys(raw);
      if (ops.length === 1 && ops[0] === "set") {
        let setVal = raw.set;
        if (SECRET_ENC_FIELDS.has(field)) {
          if (setVal === null || setVal === "") {
            out[field] = null;
            continue;
          }
          if (typeof setVal === "string") {
            if (setVal.length <= 4) continue;
            setVal =
              setVal.split(":").length === 3
                ? setVal
                : encryptSecret(setVal);
          }
        }
        out[field] = toDriverValue(col, setVal);
        continue;
      }
      if (ops.length === 1 && ["increment", "decrement", "multiply", "divide"].includes(ops[0]!)) {
        const op = ops[0]!;
        const n = raw[op];
        const symbol = { increment: "+", decrement: "-", multiply: "*", divide: "/" }[op]!;
        out[field] = sql`${col} ${sql.raw(symbol)} ${n}`;
        continue;
      }
      throw unsupported(`update operator ${JSON.stringify(ops)} on ${model}.${key}`);
    }
    let value = raw;
    if (SECRET_ENC_FIELDS.has(field)) {
      if (value === null || value === "") {
        out[field] = null;
        continue;
      }
      if (typeof value === "string") {
        // Edit forms show last-4; re-submitting that must not overwrite ciphertext.
        if (opts.forUpdate && value.length <= 4) continue;
        // Skip double-encrypt when already ciphertext (iv:tag:data)
        value =
          value.split(":").length === 3 ? value : encryptSecret(value);
      }
    }
    out[field] = toDriverValue(col, value);
  }
  if (opts.injectUser && out.userId === undefined && columns.userId) {
    out.userId = getUserId();
  }
  return out;
}

/** Re-read a row (with select/include) after a write, or just coerce the returned row. */
async function finishWrite(
  model: ModelName,
  written: Row,
  args: Args,
): Promise<Row> {
  if (args.select || args.include) {
    const [row] = await runFind(model, {
      where: { id: written.id },
      select: args.select,
      include: args.include,
    });
    if (!row) throw notFound(model);
    return row;
  }
  return coerceRow(model, written);
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

const AGG_FNS = { _sum: "sum", _avg: "avg", _min: "min", _max: "max" } as const;

function aggregateSelections(model: ModelName, args: Args) {
  const { columns } = meta(model);
  const fields: Record<string, SQL> = {};
  const layout: { group: string; field: string; key: string; kind: string }[] = [];
  let i = 0;
  for (const group of ["_count", "_sum", "_avg", "_min", "_max"] as const) {
    const spec = args[group];
    if (!spec) continue;
    if (group === "_count") {
      const entries = spec === true ? { _all: true } : spec;
      for (const [field, on] of Object.entries<any>(entries)) {
        if (!on) continue;
        const key = `a${i++}`;
        if (field === "_all") fields[key] = sql`count(*)`;
        else {
          const col = columns[resolveField(model, field)];
          if (!col) throw unsupported(`_count field "${field}" on ${model}`);
          fields[key] = sql`count(${col})`;
        }
        layout.push({ group, field, key, kind: "number" });
      }
      continue;
    }
    for (const [field, on] of Object.entries<any>(spec)) {
      if (!on) continue;
      const col = columns[resolveField(model, field)];
      if (!col) throw unsupported(`${group} field "${field}" on ${model}`);
      const key = `a${i++}`;
      const fn = AGG_FNS[group];
      fields[key] = sql`${sql.raw(fn)}(${col})`;
      layout.push({
        group,
        field,
        key,
        kind: col.columnType === "PgTimestamp" ? "date" : col.dataType === "string" && col.columnType !== "PgNumeric" ? "string" : "number",
      });
    }
  }
  return { fields, layout };
}

function readAggregate(raw: unknown, kind: string): unknown {
  if (raw === null || raw === undefined) return null;
  if (kind === "date") return raw instanceof Date ? raw : new Date(`${String(raw)}Z`);
  if (kind === "string") return raw;
  return Number(raw);
}

function shapeAggregates(
  layout: { group: string; field: string; key: string; kind: string }[],
  row: Row,
  args: Args,
): Row {
  const out: Row = {};
  for (const l of layout) {
    const value = readAggregate(row[l.key], l.kind);
    if (l.group === "_count" && args._count === true) {
      out._count = value;
      continue;
    }
    (out[l.group] ??= {})[l.field] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Delegate
// ---------------------------------------------------------------------------

function makeDelegate(model: ModelName) {
  const { table, columns } = meta(model);

  const one = async (args: Args, orThrow: boolean): Promise<Row | null> => {
    const [row] = await runFind(model, { ...args, take: 1 });
    if (!row && orThrow) throw notFound(model);
    return row ?? null;
  };

  const createRow = async (args: Args): Promise<Row> => {
    // Split off nested relation writes: `{ children: { create: [...] } }` / `{ parent: { connect } }`.
    const scalar: Row = {};
    const nested: [RelationDef, Row][] = [];
    for (const [key, value] of Object.entries(args.data ?? {})) {
      const rel = value !== undefined ? relationOf(model, key) : undefined;
      if (!rel) {
        scalar[key] = value;
        continue;
      }
      const op = value as Row;
      if (rel.kind === "many") {
        nested.push([rel, op]);
      } else if (op?.connect) {
        const target = await delegateFor(rel.target).findFirst({ where: op.connect });
        if (!target) throw notFound(rel.target);
        scalar[rel.local] = target[rel.foreign];
      } else {
        throw unsupported(`nested write on to-one relation ${model}.${key} (use connect or set the foreign key)`);
      }
    }

    const values = buildValues(model, scalar, { injectUser: true, forUpdate: false });
    const [written] = await serial(() => getDb().insert(table).values(values).returning());

    for (const [rel, op] of nested) {
      const children = delegateFor(rel.target);
      const items: Row[] = [op.create, op.createMany?.data].flat().filter(Boolean);
      for (const item of items) {
        await children.create({
          data: { ...item, [rel.foreign]: (written as Row)[rel.local] },
        });
      }
    }
    return finishWrite(model, written as Row, args);
  };

  const updateRows = async (where: any, data: Row): Promise<Row[]> => {
    const values = buildValues(model, data, { injectUser: false, forUpdate: true });
    const w = buildWhere(model, table, where);
    if (Object.keys(values).length === 0) {
      return (await serial(() => getDb().select().from(table).where(w))) as Row[];
    }
    return (await serial(() => getDb().update(table).set(values).where(w).returning())) as Row[];
  };

  return {
    findMany: (args: Args = {}) => runFind(model, args),
    findFirst: (args: Args = {}) => one(args, false),
    findFirstOrThrow: (args: Args = {}) => one(args, true),
    findUnique: (args: Args) => one(args, false),
    findUniqueOrThrow: (args: Args) => one(args, true),

    create: (args: Args) => createRow(args),

    createMany: async (args: Args): Promise<{ count: number }> => {
      const list: Row[] = Array.isArray(args.data) ? args.data : [args.data];
      if (list.length === 0) return { count: 0 };
      const values = list.map((d) =>
        buildValues(model, d, { injectUser: true, forUpdate: false }),
      );
      let q: any = getDb().insert(table).values(values);
      if (args.skipDuplicates) q = q.onConflictDoNothing();
      const res = await serial(() => q.returning({ id: columns.id! }));
      return { count: (res as unknown[]).length };
    },

    update: async (args: Args) => {
      const rows = await updateRows(args.where, args.data ?? {});
      if (rows.length === 0) throw notFound(model);
      return finishWrite(model, rows[0]!, args);
    },

    updateMany: async (args: Args): Promise<{ count: number }> => {
      const rows = await updateRows(args.where, args.data ?? {});
      return { count: rows.length };
    },

    upsert: async (args: Args) => {
      const existing = await one({ where: args.where, select: { id: true } }, false);
      if (!existing) {
        // Prisma compound/unique keys in `where` are not part of create payloads — create is explicit.
        return createRow({ ...args, data: args.create });
      }
      const rows = await updateRows({ id: existing.id }, args.update ?? {});
      return finishWrite(model, rows[0]!, args);
    },

    delete: async (args: Args) => {
      // Savepoint: a failed delete (FK violation) must not poison the outer transaction
      // when callers do `.catch(() => undefined)`.
      const deleted: Row[] = await serial(() =>
        getDb().transaction(async (sp) =>
          (await sp.delete(table).where(buildWhere(model, table, args.where)).returning()) as Row[],
        ),
      );
      if (deleted.length === 0) throw notFound(model);
      return coerceRow(model, deleted[0]!);
    },

    deleteMany: async (args: Args = {}): Promise<{ count: number }> => {
      const res = await serial(() =>
        getDb()
          .delete(table)
          .where(buildWhere(model, table, args.where))
          .returning({ id: columns.id! }),
      );
      return { count: res.length };
    },

    count: async (args: Args = {}): Promise<number> => {
      const [res] = await serial(() =>
        getDb()
          .select({ n: sql<number>`count(*)` })
          .from(table)
          .where(buildWhere(model, table, args.where)),
      );
      return Number(res?.n ?? 0);
    },

    aggregate: async (args: Args = {}): Promise<Row> => {
      const { fields, layout } = aggregateSelections(model, args);
      if (layout.length === 0) return {};
      const [row] = await serial(() =>
        getDb()
          .select(fields)
          .from(table)
          .where(buildWhere(model, table, args.where)),
      );
      return shapeAggregates(layout, (row ?? {}) as Row, args);
    },

    groupBy: async (args: Args): Promise<Row[]> => {
      const by: string[] = (Array.isArray(args.by) ? args.by : [args.by]).map((f: string) =>
        resolveField(model, f),
      );
      const { fields, layout } = aggregateSelections(model, args);
      const groupCols: Record<string, PgColumn> = {};
      for (const f of by) {
        const c = columns[f];
        if (!c) throw unsupported(`groupBy field "${f}" on ${model}`);
        groupCols[`g_${f}`] = c;
      }
      let q: any = getDb()
        .select({ ...groupCols, ...fields })
        .from(table)
        .where(buildWhere(model, table, args.where))
        .groupBy(...Object.values(groupCols));
      if (args.having) throw unsupported("groupBy having");
      if (args.orderBy) {
        const list = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        const exprs: SQL[] = [];
        for (const entry of list) {
          for (const [k, dir] of Object.entries<any>(entry)) {
            if (k.startsWith("_")) {
              for (const [field, d] of Object.entries<any>(dir)) {
                const hit = layout.find((l) => l.group === k && l.field === field);
                if (!hit) throw unsupported(`groupBy orderBy ${k}.${field} (must also be selected)`);
                exprs.push(sql`${fields[hit.key]} ${sql.raw(d === "desc" ? "desc" : "asc")}`);
              }
            } else {
              exprs.push(...orderEntry(model, table, k, dir));
            }
          }
        }
        if (exprs.length) q = q.orderBy(...exprs);
      }
      if (args.take !== undefined) q = q.limit(args.take);
      if (args.skip) q = q.offset(args.skip);

      const rows: Row[] = await serial(() => q);
      return rows.map((r) => {
        const out: Row = {};
        for (const f of by) {
          out[f] = r[`g_${f}`];
        }
        coerceRow(model, out);
        return { ...out, ...shapeAggregates(layout, r, args) };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

/** Plain row type for a model, with `numeric` columns as numbers (what Prisma Floats were). */
type TableCols<M extends ModelName> = (typeof MODEL_TABLES)[M]["_"]["columns"];
type TableSelect<M extends ModelName> = (typeof MODEL_TABLES)[M]["$inferSelect"];
type NumericToNumber<M extends ModelName> = {
  [K in keyof TableSelect<M>]: K extends keyof TableCols<M>
    ? TableCols<M>[K] extends { _: { columnType: "PgNumeric" } }
      ? null extends TableSelect<M>[K]
        ? number | null
        : number
      : TableSelect<M>[K]
    : TableSelect<M>[K];
};

type LegacyAliases<M extends ModelName> = M extends "personalDocument"
  ? { identifier: string | null }
  : M extends "vehicle"
    ? { insurancePolicyNumber: string | null }
    : unknown;

export type ModelRow<M extends ModelName> = NumericToNumber<M> & LegacyAliases<M>;

type Falsy = false | undefined;
type RelsOf<M extends ModelName> = M extends keyof RelationTypes ? RelationTypes[M] : {};

type RelationResult<M extends ModelName, K, V> = K extends keyof RelsOf<M>
  ? RelsOf<M>[K] extends {
      target: infer T extends ModelName;
      many: infer Many;
      optional: infer Opt;
    }
    ? Many extends true
      ? Result<T, V extends true ? {} : V>[]
      : Opt extends true
        ? Result<T, V extends true ? {} : V> | null
        : Result<T, V extends true ? {} : V>
    : never
  : never;

type CountResult<C> = C extends { select: infer S }
  ? { _count: { [R in keyof S]: number } }
  : { _count: Record<string, number> };

type Projected<M extends ModelName, S> = {
  [K in keyof S as S[K] extends Falsy ? never : K]: K extends "_count"
    ? CountResult<S[K]>["_count"]
    : K extends keyof RelsOf<M>
      ? RelationResult<M, K, S[K]>
      : K extends keyof ModelRow<M>
        ? ModelRow<M>[K]
        : never;
};

/** Mirrors Prisma's result typing: plain rows, `select` projections and `include` relations. */
type Result<M extends ModelName, A> = A extends { select: infer S }
  ? Projected<M, S>
  : A extends { include: infer I }
    ? ModelRow<M> & Projected<M, I>
    : ModelRow<M>;

type QueryArgs = Record<string, any>;

/** Loose stand-in for Prisma.<Model>WhereInput when building filters incrementally. */
export type WhereInput = Record<string, any>;

type Delegate<M extends ModelName> = {
  findMany<const A extends QueryArgs = {}>(args?: A): Promise<Result<M, A>[]>;
  findFirst<const A extends QueryArgs = {}>(args?: A): Promise<Result<M, A> | null>;
  findFirstOrThrow<const A extends QueryArgs = {}>(args?: A): Promise<Result<M, A>>;
  findUnique<const A extends QueryArgs>(args: A): Promise<Result<M, A> | null>;
  findUniqueOrThrow<const A extends QueryArgs>(args: A): Promise<Result<M, A>>;
  create<const A extends QueryArgs>(args: A): Promise<Result<M, A>>;
  createMany(args: QueryArgs): Promise<{ count: number }>;
  update<const A extends QueryArgs>(args: A): Promise<Result<M, A>>;
  updateMany(args: QueryArgs): Promise<{ count: number }>;
  upsert<const A extends QueryArgs>(args: A): Promise<Result<M, A>>;
  delete<const A extends QueryArgs>(args: A): Promise<Result<M, A>>;
  deleteMany(args?: QueryArgs): Promise<{ count: number }>;
  count(args?: QueryArgs): Promise<number>;
  aggregate(args?: QueryArgs): Promise<any>;
  groupBy(args: QueryArgs): Promise<any[]>;
};

export type PrismaShim = { [M in ModelName]: Delegate<M> } & {
  $transaction<T>(fn: (tx: PrismaShim) => Promise<T>, options?: unknown): Promise<T>;
  $transaction<T extends readonly unknown[]>(
    ops: [...T],
    options?: unknown,
  ): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

const delegates = new Map<string, Delegate_>();

function delegateFor(name: string): Delegate_ {
  let delegate = delegates.get(name);
  if (!delegate) {
    delegate = makeDelegate(modelOf(name)) as unknown as Delegate_;
    delegates.set(name, delegate);
  }
  return delegate;
}

const client: any = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop === "symbol" || prop === "then") return undefined;

      if (prop === "$transaction") {
        return async (arg: unknown) => {
          // Reuse the surrounding withUserDb transaction (throws if there is none).
          getDb();
          if (typeof arg === "function") return arg(client);
          if (Array.isArray(arg)) return Promise.all(arg);
          throw unsupported("$transaction argument");
        };
      }
      if (prop === "$connect") return async () => undefined;
      if (prop === "$disconnect") return () => getPool().end();
      if (prop.startsWith("$")) throw unsupported(`client method ${prop}`);

      if (!isModelName(prop)) {
        throw unsupported(`model "${prop}" (no finance table mapped; see src/lib/db-models.ts)`);
      }
      return delegateFor(prop);
    },
  },
);

export const prisma = client as PrismaShim;

/** findMany by model name (kept from the Prisma era; models are always present now). */
export async function safeFindMany<T>(model: ModelName, args?: object): Promise<T[]> {
  return (await runFind(modelOf(model), (args ?? {}) as Args)) as T[];
}
