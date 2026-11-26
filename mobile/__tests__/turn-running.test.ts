import { emptySessionView } from "eve/events";
import { deriveTurnRunning, isZombieBusy } from "../src/chat/turn-running";
import type { EveMessage } from "eve/client";

function assistant(
  status: "streaming" | "complete",
  tools: readonly { name: string; state: string }[] = [],
): EveMessage {
  return {
    role: "assistant",
    metadata: { status },
    parts: [
      ...tools.map((tool) => ({
        type: "tool" as const,
        name: tool.name,
        state: tool.state,
        callId: "c1",
      })),
      { type: "text" as const, text: "hi" },
    ],
  } as EveMessage;
}

describe("deriveTurnRunning", () => {
  it("treats streaming assistant as running even when idle", () => {
    expect(
      deriveTurnRunning({
        status: "idle",
        messages: [assistant("streaming")],
      }),
    ).toBe(true);
  });

  it("treats busy + running tool as running", () => {
    expect(
      deriveTurnRunning({
        status: "busy",
        messages: [assistant("complete", [{ name: "coder", state: "running" }])],
      }),
    ).toBe(true);
  });

  it("does not treat zombie busy after complete+cancelled as running", () => {
    expect(
      deriveTurnRunning({
        status: "busy",
        messages: [
          assistant("complete", [{ name: "coder", state: "cancelled" }]),
        ],
      }),
    ).toBe(false);
  });

  it("keeps busy running before an assistant reply exists", () => {
    expect(
      deriveTurnRunning({
        status: "busy",
        messages: [{ role: "user", parts: [{ type: "text", text: "go" }] } as EveMessage],
      }),
    ).toBe(true);
  });

  it("ignores resuming for Stop (catch-up is not live generation)", () => {
    expect(
      deriveTurnRunning({
        status: "resuming",
        messages: [
          assistant("complete", [{ name: "coder", state: "cancelled" }]),
        ],
      }),
    ).toBe(false);
  });

  it("flags zombie busy when store is busy after a complete cancelled turn", () => {
    expect(
      isZombieBusy({
        status: "busy",
        messages: [
          assistant("complete", [{ name: "coder", state: "cancelled" }]),
        ],
      }),
    ).toBe(true);
    expect(
      isZombieBusy({
        status: "busy",
        messages: [assistant("streaming", [{ name: "coder", state: "running" }])],
      }),
    ).toBe(false);
  });
});
