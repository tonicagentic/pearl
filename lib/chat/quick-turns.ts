/** One quick-path line stored on the chat until eve imports it. */
export type QuickTurn = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
};

/** Stable ids for eve `history` and for hiding the overlay once imported. */
export function toQuickTurns(
  chatId: string,
  drafts: readonly { readonly role: "user" | "assistant"; readonly text: string }[],
  startIndex = 0,
): QuickTurn[] {
  const out: QuickTurn[] = [];
  let index = startIndex;
  for (const draft of drafts) {
    const text = draft.text.trim();
    if (!text) continue;
    out.push({
      id: `quick:${chatId}:${index}`,
      role: draft.role,
      text,
    });
    index += 1;
  }
  return out;
}

/** eve `history` entries — only role + text + id. */
export function quickTurnsAsHistory(
  turns: readonly QuickTurn[],
): Array<{ id: string; role: "user" | "assistant"; text: string }> {
  return turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    text: turn.text,
  }));
}

/** Normalize a chat row's quickTurns jsonb into a typed list. */
export function quickTurnsFromRow(
  row: { readonly quickTurns: unknown } | undefined,
): QuickTurn[] {
  return Array.isArray(row?.quickTurns) ? (row.quickTurns as QuickTurn[]) : [];
}

/** Quick turns not yet present as imported eve messages. */
export function quickTurnsPendingImport(
  quick: readonly QuickTurn[],
  historyIds: ReadonlySet<string>,
): QuickTurn[] {
  return quick.filter((turn) => !historyIds.has(turn.id));
}
