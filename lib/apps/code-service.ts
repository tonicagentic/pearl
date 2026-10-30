import { getMiniApp, toPublicMiniApp, updateMiniApp, type MiniAppPublic } from "./queries.ts";
import { seedPromptForFx } from "./seed.ts";

export type CodeWithFxInput = {
  readonly userId: string;
  readonly appId: string;
  readonly task: string;
};

function summarizeFxEvents(events: readonly { type: string; [key: string]: unknown }[]): string {
  const texts: string[] = [];
  for (const event of events) {
    if (event.type === "assistant_message" || event.type === "text") {
      const content = event.content;
      const text =
        typeof event.text === "string"
          ? event.text
          : typeof content === "string"
            ? content
            : null;
      if (text) texts.push(text);
    }
  }
  const joined = texts.join("\n").trim();
  if (joined) return joined.slice(0, 4_000);
  return "fx finished the turn without a text reply.";
}

/** Resume the app's fx session with a coding task. */
export async function codeWithFx(
  input: CodeWithFxInput,
): Promise<
  | {
      readonly status: "ok";
      readonly app: MiniAppPublic;
      readonly summary: string;
      readonly previewUrl?: string;
    }
  | { readonly status: "error"; readonly error: string }
> {
  const app = await getMiniApp(input.userId, input.appId);
  if (!app) {
    return { status: "error", error: "Mini app not found." };
  }

  const task = input.task.trim();
  if (!task) {
    return { status: "error", error: "Pass a coding task for fx." };
  }

  try {
    const [{ pearlBuilderFx }, { sandboxName }] = await Promise.all([
      import("./fx-agent.ts"),
      import("durable-harness/sandbox"),
    ]);

    // local/world durability requires wrun_* ids from the agent — never UUIDs.
    let fxSessionId = app.fxSessionId;
    if (!fxSessionId) {
      fxSessionId = await pearlBuilderFx.newSessionId();
      await updateMiniApp(input.userId, app.id, { fxSessionId });
    }

    const derivedSandbox = sandboxName(fxSessionId);
    if (derivedSandbox !== app.sandboxName) {
      await updateMiniApp(input.userId, app.id, { sandboxName: derivedSandbox });
    }

    await updateMiniApp(input.userId, app.id, { status: "building" });

    const needsSeed = app.status === "draft";
    const repoLine =
      app.githubOwner && app.githubRepo
        ? `Repo: ${app.githubOwner}/${app.githubRepo} (private, managed by Pearl).`
        : `Draft mini app "${app.slug}" — no GitHub repo yet; work only in /workspace. publish_app will create pearl-* later.`;
    const promptParts = [
      needsSeed
        ? seedPromptForFx({ title: app.title, slug: app.slug })
        : null,
      repoLine,
      "Work only under /workspace. Do not print secrets. Prefer npm for installs.",
      "",
      `Task: ${task}`,
    ].filter(Boolean);

    const session = pearlBuilderFx.session(fxSessionId);
    const turn = session.prompt(promptParts.join("\n"));
    await turn.accepted;

    const events: Array<{ type: string; [key: string]: unknown }> = [];
    for await (const event of turn) {
      events.push(event as { type: string; [key: string]: unknown });
    }
    const result = await turn.result;
    if (result.stopReason === "error") {
      await updateMiniApp(input.userId, app.id, { status: "failed" });
      return {
        status: "error",
        error: result.error?.message ?? "fx turn failed.",
      };
    }

    await updateMiniApp(input.userId, app.id, {
      status: "building",
      sandboxName: derivedSandbox,
    });

    let summary = summarizeFxEvents(events);
    let previewUrl: string | null = null;
    try {
      const { ensureAppPreview } = await import("./preview-service.ts");
      const preview = await ensureAppPreview({
        userId: input.userId,
        appId: app.id,
      });
      if (preview.status === "ok") {
        previewUrl = preview.previewUrl;
        summary = `${summary}\n\nDraft preview: ${preview.previewUrl} (also in Apps).`;
      } else {
        summary = `${summary}\n\nDraft preview unavailable: ${preview.error}`;
      }
    } catch (previewError) {
      summary = `${summary}\n\nDraft preview unavailable: ${
        previewError instanceof Error
          ? previewError.message
          : String(previewError)
      }`;
    }

    const refreshed = await getMiniApp(input.userId, app.id);
    return {
      status: "ok",
      app: toPublicMiniApp(refreshed ?? { ...app, sandboxName: derivedSandbox }),
      summary,
      ...(previewUrl ? { previewUrl } : {}),
    };
  } catch (error) {
    await updateMiniApp(input.userId, app.id, { status: "failed" });
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
