export type AreaProperties = Record<string, unknown>;

/** Parse a value as JSON when possible; unquoted text is a string. */
export function parsePropertyValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    if (/^[\[{\"]/.test(text.trim())) {
      throw new Error(
        "Enter valid JSON for objects, arrays, and quoted strings.",
      );
    }
    return text;
  }
}

export function formatPropertyValue(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }
  return Object.entries(value).every(
    ([key, item]) => key !== "__proto__" && isJsonValue(item, depth + 1),
  );
}

export function validateAreaProperties(input: unknown): AreaProperties {
  if (
    !input ||
    Array.isArray(input) ||
    typeof input !== "object" ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new Error("Properties must be a JSON object.");
  }
  const entries = Object.entries(input);
  if (
    entries.length > 100 ||
    entries.some(
      ([key, value]) =>
        !key.trim() || key.length > 100 || key === "__proto__" || !isJsonValue(value),
    )
  ) {
    throw new Error("Use up to 100 named properties with valid JSON values.");
  }
  if (new TextEncoder().encode(JSON.stringify(input)).length > 16_384) {
    throw new Error("Properties must be smaller than 16 KB.");
  }
  return input as AreaProperties;
}
