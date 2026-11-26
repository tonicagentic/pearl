import { randomUUID } from "node:crypto";
import {
  gateway,
  hasToolCall,
  streamText,
  tool,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  GATEWAY_PROVIDER_OPTIONS,
} from "@/agent/gateway-policy";
import { PEARL_LANES } from "@/agent/model-router";
import {
  QUICK_PATH_ESCALATE_DESCRIPTION,
  QUICK_PATH_SYSTEM_PROMPT,
} from "@/lib/chat/quick-path-prompt";
import { maybeUpgradeChatTitle } from "@/lib/chat/generate-title";
import { toQuickTurns, type QuickTurn } from "@/lib/chat/quick-turns";
import {
  assertCanSpend,
  recordUsage,
  releaseReservation,
} from "@/lib/billing/ledger";
import {
  createChat,
  getChatForUser,
  saveQuickTurnsForUser,
} from "@/lib/db/queries";
import { canUseQuickPath } from "@/lib/pearl-lane";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const maxDuration = 60;

type HistoryMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

function encodeEvent(event: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    readonly chatId?: string | null;
    readonly message?: string;
  } | null;

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Provide a message." }, { status: 400 });
  }

  let chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
  let existingTurns: QuickTurn[] = [];

  if (chatId) {
    const chat = await getChatForUser(chatId, viewer.id);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
    if (
      !canUseQuickPath({
        text: message,
        hasEveSession: Boolean(chat.session),
        hasAttachments: false,
        hasCustomAgent: Boolean(chat.customAgent),
        hasRemoteAgent: Boolean(chat.remoteAgentId),
        hasProject: Boolean(chat.projectId),
        hasPinnedModel: false,
        quickTurnCount: chat.quickTurns.length,
      })
    ) {
      return NextResponse.json(
        { error: "Not eligible for quick path.", escalate: true },
        { status: 409 },
      );
    }
    existingTurns = [...chat.quickTurns];
  } else {
    if (
      !canUseQuickPath({
        text: message,
        hasEveSession: false,
        hasAttachments: false,
        hasCustomAgent: false,
        hasRemoteAgent: false,
        hasProject: false,
        hasPinnedModel: false,
        quickTurnCount: 0,
      })
    ) {
      return NextResponse.json(
        { error: "Not eligible for quick path.", escalate: true },
        { status: 409 },
      );
    }
    // Session-free quick answers must not set pendingUserMessage — that marker
    // is for Carry-out / Eve auto-send and would re-send the same turn after
    // selectChat, duplicating the quick pair in the thread.
    const created = await createChat(viewer.id);
    chatId = created.id;
  }

  const gate = await assertCanSpend({
    userId: viewer.id,
    reason: "quick-path",
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Billing required.", reason: gate.reason },
      { status: 402 },
    );
  }

  const historyMessages: HistoryMessage[] = existingTurns.map((turn) => ({
    role: turn.role,
    content: turn.text,
  }));
  historyMessages.push({ role: "user", content: message });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      let escalated = false;
      const runId = randomUUID();

      try {
        const result = streamText({
          model: gateway(PEARL_LANES.voice.primary),
          system: QUICK_PATH_SYSTEM_PROMPT,
          messages: historyMessages,
          tools: {
            escalate: tool({
              description: QUICK_PATH_ESCALATE_DESCRIPTION,
              inputSchema: z.object({
                reason: z.string().optional(),
              }),
              execute: async () => ({ escalated: true }),
            }),
          },
          stopWhen: hasToolCall("escalate"),
          providerOptions: {
            gateway: {
              ...GATEWAY_PROVIDER_OPTIONS,
              models: [PEARL_LANES.voice.fallback],
              tags: ["lane:voice", "agent:pearl", "path:quick"],
            },
          },
        });

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            const delta =
              "text" in part && typeof part.text === "string"
                ? part.text
                : "delta" in part && typeof part.delta === "string"
                  ? part.delta
                  : "";
            if (!delta) continue;
            text += delta;
            controller.enqueue(
              encodeEvent({ type: "text-delta", delta }),
            );
          } else if (part.type === "tool-call" && part.toolName === "escalate") {
            // Plan: escalate only wins when no visible text has streamed yet.
            if (!text.trim()) {
              escalated = true;
              controller.enqueue(encodeEvent({ type: "escalate" }));
            }
          }
        }

        if (escalated) {
          if (gate.reservationId && gate.reservationId !== "noop") {
            await releaseReservation(gate.reservationId);
          }
          controller.close();
          return;
        }

        const reply = text.trim();
        if (!reply) {
          controller.enqueue(
            encodeEvent({
              type: "error",
              message: "Quick path returned an empty reply.",
            }),
          );
          controller.close();
          return;
        }

        const appended = toQuickTurns(
          chatId,
          [
            { role: "user", text: message },
            { role: "assistant", text: reply },
          ],
          existingTurns.length,
        );
        const nextTurns = [...existingTurns, ...appended];
        await saveQuickTurnsForUser({
          chatId,
          userId: viewer.id,
          turns: nextTurns,
        });

        const firstUserText =
          nextTurns.find((turn) => turn.role === "user")?.text ?? message;
        const upgradedTitle = await maybeUpgradeChatTitle({
          chatId,
          userId: viewer.id,
          firstUserText,
        });

        const usage = await result.usage;
        const usageRecord = usage as unknown as {
          readonly costUsd?: number;
          readonly inputTokens?: number;
          readonly outputTokens?: number;
        };
        const costUsd =
          typeof usageRecord.costUsd === "number" ? usageRecord.costUsd : 0;

        await recordUsage({
          idempotencyKey: `quick:${runId}`,
          userId: viewer.id,
          source: "model",
          costUsd,
          reservationId: gate.reservationId,
          metadata: {
            path: "quick",
            modelId: PEARL_LANES.voice.primary,
            inputTokens: usageRecord.inputTokens ?? null,
            outputTokens: usageRecord.outputTokens ?? null,
            chatId,
          },
        });

        controller.enqueue(
          encodeEvent({
            type: "done",
            turns: nextTurns,
            chatId,
            ...(upgradedTitle ? { title: upgradedTitle } : {}),
          }),
        );
        controller.close();
      } catch (error) {
        console.error("[quick-path]", error);
        controller.enqueue(
          encodeEvent({
            type: "error",
            message:
              error instanceof Error ? error.message : "Quick path failed.",
          }),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
