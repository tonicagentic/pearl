"use client";

import type { EveAuthorizationData } from "@assistant-ui/eve";
import { makeAssistantDataUI } from "@assistant-ui/react";

export const EveAuthorization = makeAssistantDataUI<EveAuthorizationData>({
  name: "authorization",
  render: ({ data }) => (
    <div className="my-3 w-full rounded-lg border border-border px-3 py-2 text-sm">
      {data.state === "required" ? (
        <>
          <p className="font-medium">
            {data.instructions ?? `Sign in to ${data.displayName ?? data.name}`}
          </p>
          {data.userCode ? (
            <p className="mt-2">
              Code: <code className="rounded bg-muted px-1.5 py-0.5">{data.userCode}</code>
            </p>
          ) : null}
          {data.url ? (
            <a
              className="mt-2 inline-block text-foreground underline underline-offset-2"
              href={data.url}
              rel="noreferrer"
              target="_blank"
            >
              Continue to sign in
            </a>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">
          {data.outcome ?? "Authorization completed"}
        </p>
      )}
    </div>
  ),
});
