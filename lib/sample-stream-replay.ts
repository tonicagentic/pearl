/**
 * Synthesize timed v27 stream events from static thread messages so inspector
 * samples can play through Stream Replay.
 */

import type { SessionStreamEvent } from "eve/client";

export type SampleTimedStreamEvent = {
  readonly atMs: number;
  readonly event: SessionStreamEvent;
};

type RawEvent = {
  readonly type: string;
  readonly scope?: Record<string, string>;
  readonly data: Record<string, unknown>;
};

type ReplayToolPart = {
  readonly type: "tool-call";
  readonly toolCallId?: string;
  readonly toolName: string;
  readonly args?: Record<string, unknown>;
  readonly argsText?: string;
  readonly result?: unknown;
  readonly approval?: {
    readonly id?: string;
    readonly prompt?: string;
    readonly display?: string;
    readonly allowFreeform?: boolean;
    readonly options?: readonly {
      readonly id: string;
      readonly label?: string;
      readonly kind?: string;
    }[];
  };
};

type ReplayContentPart =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "reasoning"; readonly text: string }
  | ReplayToolPart
  | { readonly type: string; readonly [key: string]: unknown };

export type ReplayMessage = {
  readonly role: string;
  readonly content: string | readonly ReplayContentPart[];
  readonly metadata?: {
    readonly custom?: { readonly turnId?: string };
  };
};

export type ReplaySample = {
  readonly id: string;
  readonly messages: readonly ReplayMessage[];
};

function stamp(
  events: readonly { readonly atMs: number; readonly raw: RawEvent }[],
): SampleTimedStreamEvent[] {
  const base = Date.parse("2026-06-01T12:00:00.000Z");
  return events.map((entry, line) => ({
    atMs: entry.atMs,
    event: {
      ...entry.raw,
      meta: {
        at: new Date(base + entry.atMs).toISOString(),
        position: { index: 0, line },
      },
    } as unknown as SessionStreamEvent,
  }));
}

function textOf(content: ReplayMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter(
      (part): part is { readonly type: "text"; readonly text: string } =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function chunkText(text: string, size = 28): string[] {
  if (!text) return [""];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out.length > 0 ? out : [text];
}

function turnIdFor(message: ReplayMessage, fallback: string): string {
  return message.metadata?.custom?.turnId ?? fallback;
}

/**
 * Build a paced stream script that reconstructs sample messages.
 * HITL tool parts park with interaction.opened + turn.paused.
 */
export function eventsFromReplaySample(
  sample: ReplaySample,
): SampleTimedStreamEvent[] {
  const list: { atMs: number; raw: RawEvent }[] = [
    { atMs: 0, raw: { type: "session.started", data: {} } },
  ];
  let t = 40;
  let delivery = 0;
  let turnIndex = 0;

  const push = (raw: RawEvent, dt = 120) => {
    t += dt;
    list.push({ atMs: t, raw });
  };

  for (
    let messageIndex = 0;
    messageIndex < sample.messages.length;
    messageIndex++
  ) {
    const message = sample.messages[messageIndex]!;
    if (message.role === "user") {
      delivery += 1;
      const deliveryId = `d_${sample.id}_${delivery}`;
      const prompt = textOf(message.content);
      push({ type: "delivery.admitted", data: { deliveryId } }, 40);
      const nextAssistant = sample.messages
        .slice(messageIndex + 1)
        .find((m) => m.role === "assistant");
      const turnId = nextAssistant
        ? turnIdFor(nextAssistant, `${sample.id}-turn-${turnIndex}`)
        : `${sample.id}-turn-${turnIndex}`;
      push(
        {
          type: "delivery.consumed",
          scope: { turnId },
          data: {
            deliveryId,
            turnId,
            parts: [{ kind: "text", text: prompt }],
          },
        },
        40,
      );
      continue;
    }

    if (message.role !== "assistant") continue;

    const turnId = turnIdFor(message, `${sample.id}-turn-${turnIndex}`);
    turnIndex += 1;
    const runId = `run_${turnId}`;
    const turnScope = { turnId };
    const runScope = { runId, turnId };
    const parts =
      typeof message.content === "string"
        ? ([{ type: "text", text: message.content }] as ReplayContentPart[])
        : [...message.content];

    push(
      {
        type: "turn.started",
        scope: turnScope,
        data: {
          turnId,
          cause: { deliveryId: `d_${sample.id}_${Math.max(1, delivery)}` },
          follows: null,
        },
      },
      60,
    );
    push(
      {
        type: "model.requested",
        scope: turnScope,
        data: { runId, owner: { turnId } },
      },
      40,
    );
    push(
      {
        type: "model.started",
        scope: runScope,
        data: { runId, modelId: "test-model", attempt: 0 },
      },
      40,
    );

    let parked = false;

    parts.forEach((part, partIndex) => {
      if (part.type === "reasoning" && typeof part.text === "string") {
        const partId = `r_${turnId}_${partIndex}`;
        const chunks = chunkText(part.text, 40);
        chunks.forEach((delta, i) => {
          push(
            {
              type: "content.delta",
              scope: runScope,
              data: {
                partId,
                ...(i === 0 ? { kind: "reasoning" } : {}),
                delta,
              },
            },
            i === 0 ? 180 : 90,
          );
        });
        push(
          {
            type: "content.completed",
            scope: runScope,
            data: {
              partId,
              kind: "reasoning",
              phase: "reasoning",
              runId,
              value: part.text,
            },
          },
          80,
        );
        return;
      }

      if (part.type === "text" && typeof part.text === "string") {
        const partId = `t_${turnId}_${partIndex}`;
        const chunks = chunkText(part.text, 32);
        chunks.forEach((delta, i) => {
          push(
            {
              type: "content.delta",
              scope: runScope,
              data: {
                partId,
                ...(i === 0 ? { kind: "text" } : {}),
                delta,
              },
            },
            i === 0 ? 160 : 70,
          );
        });
        push(
          {
            type: "content.completed",
            scope: runScope,
            data: {
              partId,
              kind: "text",
              phase: "reply",
              runId,
              value: part.text,
            },
          },
          80,
        );
        return;
      }

      if (part.type !== "tool-call") return;
      const tool = part as ReplayToolPart;

      const callId = tool.toolCallId || `c_${turnId}_${partIndex}`;
      const argsText =
        tool.argsText ?? JSON.stringify(tool.args ?? {}, null, 0);
      const argChunks = chunkText(argsText, 36);
      argChunks.forEach((delta, i) => {
        push(
          {
            type: "call.input",
            scope: runScope,
            data: {
              callId,
              ...(i === 0
                ? { kind: "tool", name: tool.toolName, delta }
                : { delta }),
            },
          },
          i === 0 ? 140 : 60,
        );
      });

      push(
        {
          type: "call.requested",
          scope: runScope,
          data: {
            callId,
            capability: { kind: "tool", name: tool.toolName },
            owner: { runId },
            input: tool.args ?? {},
          },
        },
        80,
      );

      const approval = tool.approval;
      if (approval) {
        const interactionId = approval.id ?? `int_${callId}`;
        push(
          {
            type: "interaction.opened",
            scope: turnScope,
            data: {
              interactionId,
              subject: { callId },
              audience: { principalIds: ["u1"] },
              request: {
                kind: "approval",
                display: approval.display ?? "decision",
                prompt: approval.prompt ?? tool.toolName,
                ...(approval.allowFreeform ? { allowFreeform: true } : {}),
                ...(approval.options
                  ? {
                      options: approval.options.map((option) => ({
                        id: option.id,
                        label: option.label ?? option.id,
                        kind: option.kind ?? `_${option.id}`,
                      })),
                    }
                  : {
                      options: [
                        { id: "approve", label: "Allow", kind: "accept" },
                        { id: "deny", label: "Deny", kind: "decline" },
                      ],
                    }),
              },
            },
          },
          100,
        );
        push(
          {
            type: "turn.paused",
            scope: turnScope,
            data: {
              turnId,
              awaiting: [{ interactionId }],
            },
          },
          80,
        );
        parked = true;
        return;
      }

      push(
        {
          type: "call.started",
          scope: runScope,
          data: { callId },
        },
        70,
      );
      push(
        {
          type: "call.settled",
          scope: runScope,
          data: {
            callId,
            outcome: "completed",
            output: tool.result ?? { ok: true },
          },
        },
        220,
      );
    });

    if (!parked) {
      push(
        {
          type: "turn.settled",
          scope: turnScope,
          data: { turnId, outcome: "completed" },
        },
        120,
      );
    }
  }

  return stamp(list);
}
