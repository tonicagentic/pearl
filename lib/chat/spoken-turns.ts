/** One spoken line from a live voice call, waiting to join eve history. */
export type SpokenTurn = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
};

/** Live-call turns before they are written with stable chat-scoped ids. */
export type LiveSpokenDraft = {
  readonly role: "user" | "pearl";
  readonly text: string;
};

export function isLiveHistoryId(id: string | undefined): boolean {
  return typeof id === "string" && id.startsWith("live:");
}

/** Stable ids for eve `history` and for hiding the overlay once imported. */
export function toSpokenTurns(
  chatId: string,
  drafts: readonly LiveSpokenDraft[],
): SpokenTurn[] {
  const out: SpokenTurn[] = [];
  let index = 0;
  for (const draft of drafts) {
    const text = draft.text.trim();
    if (!text) continue;
    out.push({
      id: `live:${chatId}:${index}`,
      role: draft.role === "pearl" ? "assistant" : "user",
      text,
    });
    index += 1;
  }
  return out;
}

/** eve `history` entries — only role + text + id. */
export function spokenTurnsAsHistory(
  turns: readonly SpokenTurn[],
): Array<{ id: string; role: "user" | "assistant"; text: string }> {
  return turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    text: turn.text,
  }));
}

/** Normalize a chat row's spokenTurns jsonb into a typed list. */
export function spokenTurnsFromRow(
  row: { readonly spokenTurns: unknown } | undefined,
): SpokenTurn[] {
  return Array.isArray(row?.spokenTurns) ? (row.spokenTurns as SpokenTurn[]) : [];
}
