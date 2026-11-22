import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  CatalogAssertion,
  CatalogCase,
  CatalogEval,
  CatalogFixture,
  CatalogSuite,
  CatalogTurn,
} from "@/lib/dev/eval-catalog-types";

export type {
  CatalogAssertion,
  CatalogCase,
  CatalogEval,
  CatalogFixture,
  CatalogSuite,
  CatalogTurn,
} from "@/lib/dev/eval-catalog-types";

const EVALS_DIR = path.join(process.cwd(), "evals");

function assertDev(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Eval catalog is only available in development.");
  }
}

function walkEvalFiles(root: string, prefix = ""): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "fixtures" || entry.name === "node_modules") continue;
      out.push(...walkEvalFiles(full, rel));
      continue;
    }
    if (entry.name.endsWith(".eval.ts")) out.push(rel);
  }
  return out;
}

/** Unquote / un-escape a JS string or template-literal body. */
function unescapeLiteral(raw: string, quote: string): string {
  if (quote === "`") {
    return raw
      .replace(/\\`/g, "`")
      .replace(/\\\$/g, "$")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

/**
 * Read a JS string / template / concatenation expression starting at `start`
 * (index of the first quote or backtick). Returns the joined text and end index.
 */
function readStringExpression(
  source: string,
  start: number,
): { text: string; end: number } | null {
  let i = start;
  const parts: string[] = [];

  while (i < source.length) {
    while (/\s/.test(source[i] ?? "")) i++;
    const quote = source[i];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      break;
    }
    i++;
    let raw = "";
    while (i < source.length) {
      const ch = source[i]!;
      if (ch === "\\" && i + 1 < source.length) {
        raw += ch + source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        i++;
        break;
      }
      // Stop template interpolations — keep the ${...} text as-is for docs.
      if (quote === "`" && ch === "$" && source[i + 1] === "{") {
        raw += "${";
        i += 2;
        let depth = 1;
        while (i < source.length && depth > 0) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") depth--;
          if (depth > 0) raw += source[i];
          i++;
        }
        raw += "}";
        continue;
      }
      raw += ch;
      i++;
    }
    parts.push(unescapeLiteral(raw, quote));

    while (/\s/.test(source[i] ?? "")) i++;
    if (source[i] === "+") {
      i++;
      continue;
    }
    break;
  }

  if (parts.length === 0) return null;
  return { text: parts.join(""), end: i };
}

function readPropString(source: string, prop: string): string {
  const re = new RegExp(`\\b${prop}\\s*:`);
  const match = re.exec(source);
  if (!match) return "";
  const after = match.index + match[0].length;
  let i = after;
  while (/\s/.test(source[i] ?? "")) i++;
  const expr = readStringExpression(source, i);
  return expr?.text.trim() ?? "";
}

function readTags(source: string): string[] {
  const match = source.match(/\btags\s*:\s*\[([^\]]*)\]/);
  if (!match) return [];
  return [...match[1]!.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!);
}

function readTimeoutMs(source: string): number | undefined {
  const match = source.match(/\btimeoutMs\s*:\s*([\d_]+)/);
  if (!match) return undefined;
  const n = Number(match[1]!.replace(/_/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

type PositionedAssertion = { at: number; assertion: CatalogAssertion };

function collectPositionedAssertions(source: string): PositionedAssertion[] {
  const out: PositionedAssertion[] = [];

  for (const match of source.matchAll(/\bt\.succeeded\s*\(/g)) {
    out.push({ at: match.index!, assertion: { kind: "gate", name: "succeeded" } });
  }

  for (const match of source.matchAll(
    /\.(?:notCalledTool|calledTool|calledSkill|usedNoTools|noFailedCalls)\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g,
  )) {
    const method = match[0]!.slice(1, match[0]!.indexOf("("));
    const arg = match[1] ?? match[2];
    out.push({
      at: match.index!,
      assertion: {
        kind: "gate",
        name: arg ? `${method}(${arg})` : `${method}()`,
      },
    });
  }

  for (const match of source.matchAll(/\bt\.check\s*\(/g)) {
    const start = match.index! + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    const body = source.slice(start, i - 1).replace(/\s+/g, " ").trim();
    out.push({
      at: match.index!,
      assertion: {
        kind: "check",
        detail: body.slice(0, 180) + (body.length > 180 ? "…" : ""),
      },
    });
  }

  for (const match of source.matchAll(/\bt\.judge\s*\(/g)) {
    let i = match.index! + match[0].length;
    while (/\s/.test(source[i] ?? "")) i++;
    const expr = readStringExpression(source, i);
    if (!expr) continue;

    const window = source.slice(match.index!, match.index! + 2500);
    const labelMatch = window.match(/\.label\s*\(\s*["']([^"']+)["']\s*\)/);
    const atLeastMatch = window.match(/\.atLeast\s*\(\s*([\d.]+)\s*\)/);
    const threshold = atLeastMatch ? Number(atLeastMatch[1]) : undefined;

    out.push({
      at: match.index!,
      assertion: {
        kind: "judge",
        label: labelMatch?.[1],
        threshold: Number.isFinite(threshold) ? threshold : undefined,
        instructions: expr.text.trim(),
      },
    });
  }

  return out.sort((a, b) => a.at - b.at);
}

/** Parse object/string consts from a TS source into the fixture map. */
function ingestConsts(text: string, map: Map<string, string>): void {
  for (const match of text.matchAll(
    /\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*\{([\s\S]*?)\}\s+as\s+const/g,
  )) {
    const objName = match[1]!;
    const body = match[2]!;
    const lines: string[] = [];
    const nestedBlocks = [
      ...body.matchAll(/\b([A-Za-z0-9_]+)\s*:\s*\{([\s\S]*?)\}/g),
    ];

    if (nestedBlocks.length > 0) {
      // Nested one-level objects: logistics: { label: "...", ... }
      for (const nested of nestedBlocks) {
        const nestedName = nested[1]!;
        const nestedBody = nested[2]!;
        const nestedLines: string[] = [];
        for (const field of nestedBody.matchAll(
          /\b([A-Za-z0-9_]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
        )) {
          const value = field[2] ?? field[3] ?? field[4] ?? "";
          map.set(`${objName}.${nestedName}.${field[1]}`, value);
          nestedLines.push(`${field[1]}: ${value}`);
        }
        if (nestedLines.length > 0) {
          map.set(`${objName}.${nestedName}`, nestedLines.join("\n"));
          lines.push(`${nestedName}:\n  ${nestedLines.join("\n  ")}`);
        }
      }
    } else {
      for (const field of body.matchAll(
        /\b([A-Za-z0-9_]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
      )) {
        const value = field[2] ?? field[3] ?? field[4] ?? "";
        map.set(`${objName}.${field[1]}`, value);
        lines.push(`${field[1]}: ${value}`);
      }
    }
    if (lines.length > 0 && !map.has(objName)) {
      map.set(objName, lines.join("\n"));
    }
  }

  for (const match of text.matchAll(
    /\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*/g,
  )) {
    const name = match[1]!;
    if (map.has(name)) continue;
    let i = match.index! + match[0].length;
    while (/\s/.test(text[i] ?? "")) i++;
    if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
      const expr = readStringExpression(text, i);
      if (expr?.text) map.set(name, expr.text);
      continue;
    }
    if (text[i] === "[") {
      const joined = parseJoinedStringArray(text, i);
      if (joined !== null) map.set(name, joined);
    }
  }
}

function fixtureSourceForName(
  name: string,
  evalRelPath: string,
  evalSource: string,
): string {
  if (
    new RegExp(`\\bconst\\s+${name}\\s*=`).test(evalSource) &&
    !new RegExp(`\\bexport\\s+const\\s+${name}\\s*=`).test(evalSource)
  ) {
    return "local";
  }
  const suiteDir = path.dirname(path.join(EVALS_DIR, evalRelPath));
  const fixturesDir = path.join(suiteDir, "fixtures");
  if (!existsSync(fixturesDir)) return "fixtures";
  for (const entry of readdirSync(fixturesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const text = readFileSync(path.join(fixturesDir, entry.name), "utf8");
    if (new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b`).test(text)) {
      return `fixtures/${entry.name}`;
    }
  }
  return "fixtures";
}

function mapToFixture(
  name: string,
  map: Map<string, string>,
  source: string,
): CatalogFixture | null {
  const fieldEntries = [...map.entries()].filter(
    ([key]) =>
      key.startsWith(`${name}.`) &&
      !key.slice(name.length + 1).includes("."),
  );
  if (fieldEntries.length > 0) {
    const fields: Record<string, string> = {};
    for (const [key, value] of fieldEntries) {
      fields[key.slice(name.length + 1)] = value;
    }
    return { name, source, kind: "record", fields };
  }
  const text = map.get(name);
  if (text && text.trim().length >= 2) {
    return { name, source, kind: "text", text: text.slice(0, 2000) };
  }
  return null;
}

/** Suite-wide fixtures from `evals/<suite>/fixtures/`. */
function collectSuiteFixtures(suiteId: string): CatalogFixture[] {
  const fixturesDir = path.join(EVALS_DIR, suiteId, "fixtures");
  if (!existsSync(fixturesDir)) return [];
  const map = new Map<string, string>();
  const names: { name: string; file: string }[] = [];
  for (const entry of readdirSync(fixturesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const text = readFileSync(path.join(fixturesDir, entry.name), "utf8");
    ingestConsts(text, map);
    for (const match of text.matchAll(
      /\bexport\s+const\s+([A-Z][A-Z0-9_]*)\b/g,
    )) {
      names.push({ name: match[1]!, file: `fixtures/${entry.name}` });
    }
  }
  expandTemplateRefs(map);
  const out: CatalogFixture[] = [];
  const seen = new Set<string>();
  for (const { name, file } of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const fixture = mapToFixture(name, map, file);
    if (fixture) out.push(fixture);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Fixtures this eval imports from fixtures/ or defines locally. */
function collectEvalFixtures(
  source: string,
  evalRelPath: string,
  map: Map<string, string>,
): CatalogFixture[] {
  const names = new Set<string>();

  for (const match of source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*["']\.\/fixtures\/[^"']+["']/g,
  )) {
    for (const part of match[1]!.split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Z][A-Z0-9_]*$/.test(name)) names.add(name);
    }
  }

  for (const match of source.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=/g)) {
    names.add(match[1]!);
  }

  const out: CatalogFixture[] = [];
  for (const name of [...names].sort()) {
    const fixture = mapToFixture(
      name,
      map,
      fixtureSourceForName(name, evalRelPath, source),
    );
    if (fixture) out.push(fixture);
  }
  return out;
}

/** Before expanding templates, record which root fixtures a const interpolates. */
function collectFixtureDeps(map: Map<string, string>): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  for (const [key, value] of map.entries()) {
    if (key.includes(".") || !value.includes("${")) continue;
    const roots = [
      ...value.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g),
    ].map((match) => match[1]!);
    if (roots.length > 0) deps.set(key, [...new Set(roots)]);
  }
  return deps;
}

function expandTemplateRefs(map: Map<string, string>): void {
  for (let pass = 0; pass < 3; pass++) {
    for (const [key, value] of [...map.entries()]) {
      if (!value.includes("${")) continue;
      map.set(
        key,
        value.replace(
          /\$\{([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)?)\}/g,
          (_, ref) => (map.has(ref) ? map.get(ref)! : `\${${ref}}`),
        ),
      );
    }
  }
}

function parseJoinedStringArray(text: string, fromIndex: number): string | null {
  if (text[fromIndex] !== "[") return null;
  const arrEnd = text.indexOf("]", fromIndex);
  if (arrEnd === -1) return null;
  const body = text.slice(fromIndex + 1, arrEnd);
  const parts: string[] = [];
  for (const part of body.matchAll(/`([^`]*)`|"([^"]*)"|'([^']*)'/g)) {
    parts.push(part[1] ?? part[2] ?? part[3] ?? "");
  }
  if (parts.length === 0) return null;
  const after = text.slice(arrEnd, arrEnd + 80);
  const joinMatch = after.match(/\.join\(\s*(["'`])([^"'`]*)\1\s*\)/);
  const rawSep = joinMatch?.[2] ?? "\\n";
  const sep = rawSep.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  return parts.join(sep);
}

type FixtureMaps = {
  values: Map<string, string>;
  deps: Map<string, string[]>;
};

/** Resolve fixture + local eval constants referenced in template prompts. */
function loadFixtureMaps(evalRelPath: string, evalSource?: string): FixtureMaps {
  const values = new Map<string, string>();
  const suiteDir = path.dirname(path.join(EVALS_DIR, evalRelPath));
  const fixturesDir = path.join(suiteDir, "fixtures");
  if (existsSync(fixturesDir)) {
    for (const entry of readdirSync(fixturesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      ingestConsts(readFileSync(path.join(fixturesDir, entry.name), "utf8"), values);
    }
  }
  if (evalSource) ingestConsts(evalSource, values);
  const deps = collectFixtureDeps(values);
  expandTemplateRefs(values);
  return { values, deps };
}

function loadFixtureStrings(
  evalRelPath: string,
  evalSource?: string,
): Map<string, string> {
  return loadFixtureMaps(evalRelPath, evalSource).values;
}

function expandPrompt(text: string, fixtures: Map<string, string>): string {
  return text.replace(
    /\$\{([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)?)\}/g,
    (_, ref: string) => (fixtures.has(ref) ? fixtures.get(ref)! : `\${${ref}}`),
  );
}

function rootFixtureName(ref: string): string {
  return ref.split(".")[0]!;
}

/** Collect fixture names referenced in a send() argument expression. */
function readSendFixtureNames(
  source: string,
  sendMatchIndex: number,
  sendMatchLength: number,
  fixtures: Map<string, string>,
  deps: Map<string, string[]>,
): string[] {
  let i = sendMatchIndex + sendMatchLength;
  while (/\s/.test(source[i] ?? "")) i++;
  const names = new Set<string>();

  const addRef = (ref: string) => {
    const root = rootFixtureName(ref);
    if (!(fixtures.has(ref) || fixtures.has(root) || [...fixtures.keys()].some((k) => k.startsWith(`${root}.`)))) {
      return;
    }
    names.add(root);
    for (const dep of deps.get(root) ?? []) names.add(dep);
  };

  const ident = source.slice(i).match(/^([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)?)/);
  if (ident && (fixtures.has(ident[1]!) || fixtures.has(rootFixtureName(ident[1]!)))) {
    addRef(ident[1]!);
    return [...names].sort();
  }

  // Scan the send(...) argument span for ${FIXTURE} / concatenation of fixtures.
  let depth = 1;
  let end = i;
  while (end < source.length && depth > 0) {
    if (source[end] === "(") depth++;
    else if (source[end] === ")") depth--;
    end++;
  }
  const argSpan = source.slice(i, end - 1);
  for (const match of argSpan.matchAll(
    /\$\{([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)?)\}/g,
  )) {
    addRef(match[1]!);
  }

  return [...names].sort();
}

function readSendPrompt(
  source: string,
  sendMatchIndex: number,
  sendMatchLength: number,
  fixtures: Map<string, string>,
  deps: Map<string, string[]>,
): { prompt: string; fixtureNames: string[] } {
  let i = sendMatchIndex + sendMatchLength;
  while (/\s/.test(source[i] ?? "")) i++;
  const fixtureNames = readSendFixtureNames(
    source,
    sendMatchIndex,
    sendMatchLength,
    fixtures,
    deps,
  );
  const ident = source.slice(i).match(/^([A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)?)/);
  if (ident && fixtures.has(ident[1]!)) {
    return {
      prompt: fixtures.get(ident[1]!)!.trim().slice(0, 1200),
      fixtureNames,
    };
  }
  const expr = readStringExpression(source, i);
  if (!expr) return { prompt: "", fixtureNames };
  return {
    prompt: expandPrompt(expr.text, fixtures).trim().slice(0, 1200),
    fixtureNames,
  };
}

function readCaseMeta(
  source: string,
  at: number,
  fallbackLabel: string,
): { label: string; description: string } {
  const before = source.slice(Math.max(0, at - 700), at);
  const caseMatches = [
    ...before.matchAll(/\/\/\s*((?:Case\b|Scenario\b)[^\n]*)/gi),
  ];
  const lastCase = caseMatches[caseMatches.length - 1];
  let label = fallbackLabel;
  let description = "";

  if (lastCase?.[1]) {
    const raw = lastCase[1].trim();
    // "Case: title — longer blurb" or "Case: title"
    const split = raw.match(
      /^(?:Case|Scenario)\s*[—:\-]\s*(.+?)(?:\s+[—\-]\s+(.+))?$/i,
    );
    if (split) {
      label = split[1]!.trim();
      if (split[2]) description = split[2].trim();
    } else {
      label = raw.replace(/^(?:Case|Scenario)\s*[—:\-]?\s*/i, "").trim() || raw;
    }

    // Prefer an explicit following "// description: ..." line after the Case comment.
    const afterCase = before.slice(
      (lastCase.index ?? 0) + lastCase[0].length,
    );
    const descMatch = afterCase.match(
      /^\s*\/\/\s*(?:description|desc)\s*[—:\-]\s*([^\n]+)/i,
    );
    if (descMatch?.[1]) description = descMatch[1].trim();
  }

  return { label, description };
}

function buildTurn(
  source: string,
  send: RegExpMatchArray,
  nextSendAt: number,
  fixtures: Map<string, string>,
  deps: Map<string, string[]>,
  positioned: PositionedAssertion[],
  turnIndex: number,
): CatalogTurn | null {
  const { prompt, fixtureNames } = readSendPrompt(
    source,
    send.index!,
    send[0].length,
    fixtures,
    deps,
  );
  if (prompt.length < 8) return null;
  const start = send.index!;
  const assertions = positioned
    .filter((item) => item.at > start && item.at < nextSendAt)
    .map((item) => item.assertion);
  return { index: turnIndex, prompt, fixtureNames, assertions };
}

/**
 * Cases = independent scenarios (`t.session()` or standalone `t.send`).
 * Turns = sends inside one case (real multi-turn conversation).
 */
function collectCases(source: string, evalRelPath: string): CatalogCase[] {
  const { values: fixtures, deps } = loadFixtureMaps(evalRelPath, source);
  const positioned = collectPositionedAssertions(source);
  const sessions = [...source.matchAll(/\bt\.session\s*\(/g)];
  const sends = [...source.matchAll(/\b([A-Za-z_][\w]*)\.(?:send|sendFile)\s*\(/g)];

  const cases: CatalogCase[] = [];

  if (sessions.length === 0) {
    // Standalone t.send / t.sendFile — each is its own one-turn case.
    for (const send of sends) {
      if (cases.length >= 10) break;
      if (send[1] !== "t") continue;
      const idx = sends.indexOf(send);
      const nextAt = sends[idx + 1]?.index ?? source.length;
      const turn = buildTurn(source, send, nextAt, fixtures, deps, positioned, 1);
      if (!turn) continue;
      const meta = readCaseMeta(
        source,
        send.index!,
        `Case ${cases.length + 1}`,
      );
      cases.push({
        index: cases.length + 1,
        label: meta.label,
        description: meta.description,
        turns: [turn],
      });
    }
    return cases;
  }

  for (let s = 0; s < sessions.length && cases.length < 10; s++) {
    const sessionAt = sessions[s]!.index!;
    const nextSessionAt = sessions[s + 1]?.index ?? source.length;
    const caseSends = sends.filter(
      (send) =>
        send.index! > sessionAt &&
        send.index! < nextSessionAt &&
        send[1] !== "t",
    );
    const turns: CatalogTurn[] = [];
    for (let i = 0; i < caseSends.length; i++) {
      const send = caseSends[i]!;
      const nextAt =
        i + 1 < caseSends.length ? caseSends[i + 1]!.index! : nextSessionAt;
      const turn = buildTurn(
        source,
        send,
        nextAt,
        fixtures,
        deps,
        positioned,
        turns.length + 1,
      );
      if (turn) turns.push(turn);
    }
    if (turns.length === 0) continue;
    const meta = readCaseMeta(
      source,
      sessionAt,
      turns.length > 1
        ? `Case ${cases.length + 1} (${turns.length} turns)`
        : `Case ${cases.length + 1}`,
    );
    cases.push({
      index: cases.length + 1,
      label: meta.label,
      description: meta.description,
      turns,
    });
  }

  // Also pick up any t.send outside session blocks (rare).
  for (const send of sends) {
    if (send[1] !== "t") continue;
    const insideSession = sessions.some((session, idx) => {
      const start = session.index!;
      const end = sessions[idx + 1]?.index ?? source.length;
      return send.index! > start && send.index! < end;
    });
    if (insideSession) continue;
    if (cases.length >= 10) break;
    const idx = sends.indexOf(send);
    const nextAt = sends[idx + 1]?.index ?? source.length;
    const turn = buildTurn(source, send, nextAt, fixtures, deps, positioned, 1);
    if (!turn) continue;
    const meta = readCaseMeta(source, send.index!, `Case ${cases.length + 1}`);
    cases.push({
      index: cases.length + 1,
      label: meta.label,
      description: meta.description,
      turns: [turn],
    });
  }

  return cases;
}

function parseEvalFile(relPath: string): CatalogEval | null {
  const full = path.join(EVALS_DIR, relPath);
  const source = readFileSync(full, "utf8");
  if (!source.includes("defineEval")) return null;

  const id = relPath.replace(/\.eval\.ts$/, "");
  const slash = id.indexOf("/");
  const suite = slash === -1 ? id : id.slice(0, slash);
  const name = slash === -1 ? id : id.slice(slash + 1);
  const cases = collectCases(source, relPath);
  const turns = cases.flatMap((item) => item.turns);
  const fixtureMap = loadFixtureStrings(relPath, source);

  return {
    id,
    suite,
    name,
    file: `evals/${relPath}`,
    description: readPropString(source, "description"),
    tags: readTags(source),
    timeoutMs: readTimeoutMs(source),
    cases,
    turns,
    prompts: turns.map((turn) => turn.prompt),
    assertions: turns.flatMap((turn) => turn.assertions),
    fixtures: collectEvalFixtures(source, relPath, fixtureMap),
  };
}

/** Pull suite titles/blurbs from evals/README.md when present. */
function readmeSuiteMeta(): Map<string, { title: string; blurb: string }> {
  const map = new Map<string, { title: string; blurb: string }>();
  const readmePath = path.join(EVALS_DIR, "README.md");
  if (!existsSync(readmePath)) return map;

  const text = readFileSync(readmePath, "utf8");
  const sections = text.split(/^### `/m).slice(1);
  for (const section of sections) {
    const headerMatch = section.match(/^([^`]+)`\s*(?:—|-)?\s*(.*)\n/);
    if (!headerMatch) continue;
    const id = headerMatch[1]!.replace(/\/$/, "");
    const title = headerMatch[2]!.trim() || id;
    const body = section.slice(headerMatch[0].length);
    const paragraphs: string[] = [];
    let current: string[] = [];
    for (const line of body.split("\n")) {
      if (line.startsWith("|") || line.startsWith("```") || line.startsWith("###")) {
        break;
      }
      const trimmed = line.trim();
      if (!trimmed) {
        if (current.length > 0) {
          paragraphs.push(current.join(" "));
          current = [];
        }
        continue;
      }
      current.push(trimmed);
    }
    if (current.length > 0) paragraphs.push(current.join(" "));
    map.set(id, { title, blurb: paragraphs.join("\n\n") });
  }
  return map;
}

export function loadEvalCatalog(): CatalogSuite[] {
  assertDev();
  const files = walkEvalFiles(EVALS_DIR).sort();
  const evals = files
    .map(parseEvalFile)
    .filter((item): item is CatalogEval => item !== null);

  const meta = readmeSuiteMeta();
  const bySuite = new Map<string, CatalogEval[]>();
  for (const item of evals) {
    const list = bySuite.get(item.suite) ?? [];
    list.push(item);
    bySuite.set(item.suite, list);
  }

  return [...bySuite.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, suiteEvals]) => {
      const info = meta.get(id);
      return {
        id,
        title: info?.title || id,
        blurb: info?.blurb || "",
        fixtures: collectSuiteFixtures(id),
        evals: suiteEvals.sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
}
