import { readFile } from "node:fs/promises";
import path from "node:path";
import { catalogEntryForForm, blankDir } from "../form-catalog";
import { loadSpinePack, type YearSpinePack } from "../form-specs";
import { loadYearBindings, type BindingValue, type YearFormBindings } from "./index";

export type BindingAssertIssue = {
  form: string;
  key: string;
  problem: string;
};

function fieldName(binding: BindingValue): string {
  return typeof binding === "string" ? binding : binding.field;
}

function bindingType(binding: BindingValue): "text" | "checkbox" {
  if (typeof binding === "string") return "text";
  return binding.type === "checkbox" ? "checkbox" : "text";
}

/** Every spine amount/checkbox line (and identity keys we bind) should have a binding when we fill that form. */
export function assertBindingsCoverSpecs(
  year: number,
  opts?: { pack?: YearSpinePack; bindings?: YearFormBindings },
): BindingAssertIssue[] {
  const pack = opts?.pack ?? loadSpinePack(year);
  const bindings = opts?.bindings ?? loadYearBindings(year);
  const issues: BindingAssertIssue[] = [];
  if (!pack || !bindings) {
    issues.push({
      form: "*",
      key: "*",
      problem: !pack ? "missing spine pack" : "missing year bindings",
    });
    return issues;
  }

  for (const form of pack.forms) {
    const formMap = bindings.forms[form] ?? {};
    for (const spec of pack.lines.filter((l) => l.form === form)) {
      // Workpaper-only detail lines may intentionally lack a PDF box.
      if (spec.lineId === "5k") continue;
      const key = `line.${spec.lineId}`;
      if (!formMap[key]) {
        issues.push({
          form,
          key,
          problem: "spine line has no AcroForm binding",
        });
      }
    }
  }
  return issues;
}

export type InventoryField = { name: string; type: string };

export function assertBindingsInInventory(
  year: number,
  inventories: Record<string, InventoryField[]>,
  opts?: { bindings?: YearFormBindings; forms?: string[] },
): BindingAssertIssue[] {
  const bindings = opts?.bindings ?? loadYearBindings(year);
  const pack = loadSpinePack(year);
  const issues: BindingAssertIssue[] = [];
  if (!bindings || !pack) {
    issues.push({
      form: "*",
      key: "*",
      problem: "missing bindings or spine pack",
    });
    return issues;
  }

  const forms = opts?.forms ?? pack.forms;
  for (const form of forms) {
    const formMap = bindings.forms[form] ?? {};
    const inv = inventories[form];
    if (!inv) {
      issues.push({ form, key: "*", problem: "missing field inventory" });
      continue;
    }
    const byName = new Map(inv.map((f) => [f.name, f]));
    for (const [key, binding] of Object.entries(formMap)) {
      const name = fieldName(binding);
      const found = byName.get(name);
      if (!found) {
        issues.push({
          form,
          key,
          problem: `field not in inventory: ${name}`,
        });
        continue;
      }
      const want = bindingType(binding);
      const got = found.type.includes("Check") ? "checkbox" : "text";
      if (want !== got) {
        issues.push({
          form,
          key,
          problem: `type mismatch for ${name}: binding ${want}, inventory ${found.type}`,
        });
      }
    }
  }
  return issues;
}

/** Load inventories from tax-forms/{year}/fields when present. */
export async function loadInventoriesFromDisk(
  year: number,
  forms: string[],
): Promise<Record<string, InventoryField[]> | null> {
  const out: Record<string, InventoryField[]> = {};
  for (const form of forms) {
    const entry = catalogEntryForForm(form);
    if (!entry) continue;
    const file = path.join(
      blankDir(year),
      "fields",
      entry.fileName.replace(/\.pdf$/i, ".json"),
    );
    try {
      const raw = await readFile(file, "utf8");
      out[form] = JSON.parse(raw) as InventoryField[];
    } catch {
      return null;
    }
  }
  return out;
}
