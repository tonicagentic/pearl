import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { upsertChatPreviewForSession } from "@/lib/db/chat-previews";
import { requireCoderUserId } from "@/lib/coder/principal";
import { buildApprovalCard } from "@/lib/workbench/approvals";
import {
  buildCreateSimulatorBody,
  EXPO_API_BASE,
  expoCreateSessionPath,
  expoStopSessionPath,
  resolvePhonePreviewUrl,
} from "@/lib/workbench/expo-simulator";
import { buildExpoSimulatorPreview } from "@/lib/workbench/previews";
import { PEARL_EXPO_PROJECT_ID } from "@/lib/workbench/types";

/**
 * Start an Expo Simulators agent-device iOS session and surface the browser
 * preview URL on the Computer tab. Always needs approval.
 */
export default defineTool({
  approval: always(),
  description:
    "Start an Expo cloud iOS simulator (agent-device) for the pin's Expo " +
    "project, install a simulator build when buildId is set, and return the " +
    "browser preview URL for the phone Computer tab. Always needs approval. " +
    "The card must name owner/repo and the Expo project. Stop with " +
    "stopExpoSimulatorSession when the task ends. Requires EXPO_TOKEN.",
  inputSchema: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    expoProjectId: z
      .string()
      .nullish()
      .describe("Expo project UUID. Defaults to Pearl only when omitted."),
    buildId: z.string().nullish().describe("Optional EAS build id to install."),
    sessionName: z.string().nullish(),
    stopSessionId: z
      .string()
      .nullish()
      .describe("When set, stop this session instead of creating one."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const expoToken = process.env.EXPO_TOKEN?.trim();
    if (!expoToken) {
      return {
        status: "error",
        error: "EXPO_TOKEN is not configured on the server.",
      };
    }

    if (input.stopSessionId?.trim()) {
      const stopRes = await fetch(
        `${EXPO_API_BASE}${expoStopSessionPath(input.stopSessionId.trim())}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${expoToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!stopRes.ok) {
        const body = await stopRes.text();
        return {
          status: "error",
          error: `Stop session failed (${stopRes.status}): ${body.slice(0, 400)}`,
        };
      }
      return { status: "ok", stopped: input.stopSessionId.trim() };
    }

    const body = buildCreateSimulatorBody({
      expoProjectId: input.expoProjectId,
      name: input.sessionName?.trim() || `${input.owner}/${input.repo}`,
      buildId: input.buildId,
    });

    const card = buildApprovalCard({
      action: "simulator_start",
      owner: input.owner,
      repo: input.repo,
      target: body.appId,
    });

    const createRes = await fetch(`${EXPO_API_BASE}${expoCreateSessionPath()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${expoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      return {
        status: "error",
        error: `Create session failed (${createRes.status}): ${text.slice(0, 400)}`,
        card,
      };
    }

    const created = (await createRes.json()) as {
      data?: {
        id?: string;
        status?: string;
        url?: string;
        publicPreview?: boolean;
        remoteConfig?: {
          webPreviewUrl?: string;
          previewUrl?: string;
          webPreviewToken?: string;
        } | null;
      };
    };
    const sessionId = created.data?.id;
    if (!sessionId) {
      return { status: "error", error: "Expo create session returned no id." };
    }

    // Poll briefly for remoteConfig.
    let remote = created.data;
    for (let i = 0; i < 24; i += 1) {
      await new Promise((r) => setTimeout(r, 5_000));
      const poll = await fetch(
        `${EXPO_API_BASE}/v2/device-run-sessions/${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${expoToken}` } },
      );
      if (!poll.ok) continue;
      const json = (await poll.json()) as { data?: typeof remote };
      remote = json.data ?? remote;
      if (remote?.status === "in-progress" && remote.remoteConfig) break;
      if (remote?.status === "error" || remote?.status === "stopped") break;
    }

    const resolved = resolvePhonePreviewUrl({
      url: remote?.url,
      remoteConfig: remote?.remoteConfig,
      publicPreview: remote?.publicPreview,
    });

    if (resolved.previewUrl) {
      const preview = buildExpoSimulatorPreview({
        repoFullName: `${input.owner}/${input.repo}`,
        previewUrl: resolved.previewUrl,
      });
      await upsertChatPreviewForSession(ctx.session.id, preview).catch(() => null);
    }

    return {
      status: "ok",
      sessionId,
      expoProjectId: body.appId,
      isPearlDefault: body.appId === PEARL_EXPO_PROJECT_ID && !input.expoProjectId,
      previewUrl: resolved.previewUrl,
      cardSummary: card.summary,
      note: "Drive the device with agent-device. Stop the session when done.",
    };
  },
});
