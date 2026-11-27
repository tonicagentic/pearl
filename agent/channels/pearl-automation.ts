import { defineChannel, DELETE, GET, PATCH, POST } from "eve/channels";
import type { SessionAuthContext } from "eve/context";

import { CHAT_ID_MARKER } from "@/lib/agent-mode-context";
import {
  AutomationError,
  getAutomation,
  listAutomations,
  normalizeWriteInput,
  parseWriteInput,
  setAutomationLastChat,
} from "@/lib/automations";
import { toScheduleExpression } from "@/lib/automations/schedule";
import { createChat, saveChatSessionState, updateChatTitleForUser } from "@/lib/db/queries";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { betterAuthEveAuth, passwordEveAuth } from "@/lib/eve-auth";

type AutomationTarget = {
  readonly userId: string;
  readonly automationName: string;
  readonly eveScheduleName: string;
};

async function resolveRouteAuth(
  request: Request,
): Promise<SessionAuthContext | null> {
  return (
    (await betterAuthEveAuth(request)) ??
    (await passwordEveAuth(request)) ??
    null
  );
}

function unauthorized(): Response {
  return Response.json({ error: "Sign in required." }, { status: 401 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * Proactive target for Pearl automations, plus authenticated CRUD routes
 * that call schedules() through admin tools (invokeTool sets AuthKey).
 */
export default defineChannel({
  cors: true,
  routes: [
    GET("/api/automations", async (request) => {
      const auth = await resolveRouteAuth(request);
      if (!auth || auth.principalType !== "user") return unauthorized();
      await ensureUserForPrincipal({
        principalId: auth.principalId,
        attributes: auth.attributes ?? {},
      });
      const automations = await listAutomations(auth.principalId);
      return Response.json({ automations });
    }),

    POST("/api/automations", async (request, { invokeTool }) => {
      const auth = await resolveRouteAuth(request);
      if (!auth || auth.principalType !== "user") return unauthorized();
      await ensureUserForPrincipal({
        principalId: auth.principalId,
        attributes: auth.attributes ?? {},
      });

      const body = await request.json().catch(() => ({}));
      try {
        const input = parseWriteInput(body);
        const fields = normalizeWriteInput(input);
        const expression = toScheduleExpression(
          fields.triggerKind,
          fields.triggerConfig,
          fields.timezone,
        );

        const result = await invokeTool(
          "create_pearl_automation",
          {
            name: fields.name,
            instructions: fields.instructions,
            triggerKind: fields.triggerKind,
            triggerConfig: fields.triggerConfig,
            timezone: fields.timezone,
            notifyPush: fields.notifyPush,
            notifyEmail: fields.notifyEmail,
            enabled: fields.enabled,
            expression,
          },
          { auth },
        );

        if (result.outcome !== "completed") {
          const detail =
            result.outcome === "failed"
              ? result.error.message
              : result.reason;
          return badRequest(detail || "Could not create automation.");
        }

        const output = result.output as {
          readonly automation?: unknown;
          readonly error?: string;
        };
        if (output.error || !output.automation) {
          return badRequest(output.error ?? "Failed to create automation.");
        }
        return Response.json({ automation: output.automation });
      } catch (error) {
        const message =
          error instanceof AutomationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to create automation.";
        return badRequest(message);
      }
    }),

    PATCH("/api/automations/:id", async (request, { params, invokeTool }) => {
      const auth = await resolveRouteAuth(request);
      if (!auth || auth.principalType !== "user") return unauthorized();
      await ensureUserForPrincipal({
        principalId: auth.principalId,
        attributes: auth.attributes ?? {},
      });

      const id = String(params.id ?? "").trim();
      if (!id) return badRequest("Missing automation id.");

      const existing = await getAutomation(auth.principalId, id);
      if (!existing) {
        return Response.json({ error: "Automation not found." }, { status: 404 });
      }

      const body = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      // Enable/disable-only patch.
      if (
        typeof body.enabled === "boolean" &&
        body.name === undefined &&
        body.instructions === undefined &&
        body.triggerKind === undefined
      ) {
        const result = await invokeTool(
          "set_pearl_automation_enabled",
          {
            id,
            eveScheduleName: existing.eveScheduleName,
            enabled: body.enabled,
          },
          { auth },
        );
        if (result.outcome !== "completed") {
          return badRequest("Failed to update automation.");
        }
        const output = result.output as {
          readonly automation?: unknown;
          readonly error?: string;
        };
        if (output.error || !output.automation) {
          return badRequest(output.error ?? "Failed to update automation.");
        }
        return Response.json({ automation: output.automation });
      }

      try {
        const input = parseWriteInput({
          name: body.name ?? existing.name,
          instructions: body.instructions ?? existing.instructions,
          triggerKind: body.triggerKind ?? existing.triggerKind,
          triggerConfig: body.triggerConfig ?? existing.triggerConfig,
          timezone: body.timezone ?? existing.timezone,
          notifyPush:
            typeof body.notifyPush === "boolean"
              ? body.notifyPush
              : existing.notifyPush,
          notifyEmail:
            typeof body.notifyEmail === "boolean"
              ? body.notifyEmail
              : existing.notifyEmail,
          enabled:
            typeof body.enabled === "boolean"
              ? body.enabled
              : existing.enabled,
        });
        const fields = normalizeWriteInput(input, {
          notifyPush: existing.notifyPush,
          notifyEmail: existing.notifyEmail,
          enabled: existing.enabled,
        });
        const expression = toScheduleExpression(
          fields.triggerKind,
          fields.triggerConfig,
          fields.timezone,
        );

        const result = await invokeTool(
          "update_pearl_automation",
          {
            id,
            eveScheduleName: existing.eveScheduleName,
            name: fields.name,
            instructions: fields.instructions,
            triggerKind: fields.triggerKind,
            triggerConfig: fields.triggerConfig,
            timezone: fields.timezone,
            notifyPush: fields.notifyPush,
            notifyEmail: fields.notifyEmail,
            enabled: fields.enabled,
            expression,
          },
          { auth },
        );
        if (result.outcome !== "completed") {
          return badRequest("Failed to update automation.");
        }
        const output = result.output as {
          readonly automation?: unknown;
          readonly error?: string;
        };
        if (output.error || !output.automation) {
          return badRequest(output.error ?? "Failed to update automation.");
        }
        return Response.json({ automation: output.automation });
      } catch (error) {
        const message =
          error instanceof AutomationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to update automation.";
        return badRequest(message);
      }
    }),

    DELETE("/api/automations/:id", async (request, { params, invokeTool }) => {
      const auth = await resolveRouteAuth(request);
      if (!auth || auth.principalType !== "user") return unauthorized();
      await ensureUserForPrincipal({
        principalId: auth.principalId,
        attributes: auth.attributes ?? {},
      });

      const id = String(params.id ?? "").trim();
      if (!id) return badRequest("Missing automation id.");

      const existing = await getAutomation(auth.principalId, id);
      if (!existing) {
        return Response.json({ error: "Automation not found." }, { status: 404 });
      }

      const result = await invokeTool(
        "delete_pearl_automation",
        { id, eveScheduleName: existing.eveScheduleName },
        { auth },
      );
      if (result.outcome !== "completed") {
        return badRequest("Failed to delete automation.");
      }
      const output = result.output as { readonly error?: string; readonly ok?: boolean };
      if (output.error) return badRequest(output.error);
      return Response.json({ ok: true });
    }),
  ],

  async receive({ message, target, ...send }, { from }) {
    const typed = target as AutomationTarget;
    const userId = String(typed.userId ?? "").trim();
    const automationName = String(typed.automationName ?? "").trim() || "Automation";
    const eveScheduleName = String(typed.eveScheduleName ?? "").trim();
    if (!userId) {
      throw new Error("pearl-automation target needs userId.");
    }

    const chat = await createChat(userId);
    await updateChatTitleForUser(chat.id, userId, automationName);

    if (eveScheduleName) {
      await setAutomationLastChat({
        eveScheduleName,
        chatId: chat.id,
      });
    }

    const clientContext = JSON.stringify({
      [CHAT_ID_MARKER]: chat.id,
    });

    const delivery = await from(`chat:${chat.id}`).send(message, {
      ...send,
      title: automationName,
      context: [
        ...(send.context ?? []),
        `Client context: ${clientContext}`,
        `This turn was started by a Pearl automation named "${automationName}".`,
      ],
    });

    if (delivery.sessionId) {
      await saveChatSessionState({
        chatId: chat.id,
        userId,
        session: {
          sessionId: delivery.sessionId,
          streamIndex: 0,
        },
      });
    }

    return delivery;
  },
});
