/**
 * Tolerant extraction of write_file / edit_file fields from streaming
 * argsText (partial JSON) or settled args objects.
 */

function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

/** Pull a JSON string field that may still be incomplete while streaming. */
function extractStreamingStringField(
  text: string,
  field: string,
): string | undefined {
  const key = `"${field}"`;
  const keyIndex = text.indexOf(key);
  if (keyIndex < 0) return undefined;
  const afterKey = text.slice(keyIndex + key.length);
  const colon = afterKey.indexOf(":");
  if (colon < 0) return undefined;
  let i = colon + 1;
  while (i < afterKey.length && /\s/.test(afterKey[i]!)) i += 1;
  if (afterKey[i] !== '"') return undefined;
  i += 1;
  let out = "";
  let escaped = false;
  for (; i < afterKey.length; i += 1) {
    const ch = afterKey[i]!;
    if (escaped) {
      out += `\\${ch}`;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      return unescapeJsonString(out);
    }
    out += ch;
  }
  // Incomplete string — return what we have so far.
  return unescapeJsonString(out);
}

export function writeFilePathFromArgs(
  args: Record<string, unknown> | undefined,
  argsText: string | undefined,
): string | undefined {
  if (typeof args?.filePath === "string" && args.filePath.trim()) {
    return args.filePath;
  }
  if (typeof args?.path === "string" && args.path.trim()) {
    return args.path;
  }
  if (argsText) {
    return extractStreamingStringField(argsText, "filePath");
  }
  return undefined;
}

export function writeFileContentFromArgs(
  args: Record<string, unknown> | undefined,
  argsText: string | undefined,
): string | undefined {
  if (typeof args?.content === "string") {
    return args.content;
  }
  if (argsText) {
    return extractStreamingStringField(argsText, "content");
  }
  return undefined;
}

export function editFileArgsFromParts(
  args: Record<string, unknown> | undefined,
): {
  readonly filePath?: string;
  readonly oldText?: string;
  readonly newText?: string;
} {
  return {
    filePath:
      typeof args?.filePath === "string" ? args.filePath : undefined,
    oldText: typeof args?.oldText === "string" ? args.oldText : undefined,
    newText: typeof args?.newText === "string" ? args.newText : undefined,
  };
}
