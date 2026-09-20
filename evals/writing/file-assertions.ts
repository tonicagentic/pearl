// Shared assertions for the file-artifact contract: written works (blog
// posts, essays, multi-paragraph drafts) are delivered as canvas files via
// write_file, and the chat thread stays short — critique and decisions, not
// the prose itself (docs/writing-enhancement-plan.md, Phase 2).

type ToolCallLike = {
  readonly name: string;
  readonly status?: string;
  readonly input?: unknown;
};

type TurnLike = {
  readonly toolCalls: readonly ToolCallLike[];
  readonly message?: string | null;
};

// The artifact content: everything the agent wrote via write_file this turn,
// joined in write order. Completed and streamed calls only.
export function writtenFileContent(turn: TurnLike): string {
  return turn.toolCalls
    .filter(
      (call) =>
        call.name === "write_file" &&
        (call.status === undefined || call.status === "completed"),
    )
    .map((call) => {
      const input = call.input as { content?: string } | undefined;
      return typeof input?.content === "string" ? input.content : "";
    })
    .filter((content) => content.length > 0)
    .join("\n\n");
}

// The thread must not carry the artifact: the reply does not re-paste the
// file's opening verbatim. A full draft (or full edited version) pasted into
// the chat is exactly the flooding this contract forbids, while a one-line
// note on a short file stays fine.
export function threadDoesNotRepeatArtifact(
  turn: TurnLike,
  fileContent: string,
): boolean {
  const message = turn.message ?? "";
  const window = Math.min(120, Math.floor(fileContent.length / 2));
  if (window < 20) {
    return true;
  }
  return !message.includes(fileContent.slice(0, window));
}
