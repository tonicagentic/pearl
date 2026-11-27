"use client";

import type { EveAuthorizationData } from "@assistant-ui/eve";
import { makeAssistantDataUI } from "@assistant-ui/react";

import { PermissionGrant } from "@/components/assistant-ui/elements/permission-grant";
import { inkButton } from "@/components/assistant-ui/elements/surfaces";
import { PluginLogo } from "@/components/connections/plugin-logo";
import { authorizationGrantView } from "@/lib/chat/authorization-grant";
import { cn } from "@/lib/utils";

export const EveAuthorization = makeAssistantDataUI<EveAuthorizationData>({
  name: "authorization",
  render: ({ data }) => {
    const grant = authorizationGrantView(data);
    const continueUrl =
      data.state === "required" &&
      data.url &&
      /^https?:\/\//i.test(data.url)
        ? data.url
        : undefined;

    return (
      <PermissionGrant
        capability={grant.capability}
        reach={grant.reach}
        scope={grant.scope}
        icon={
          grant.markId ? (
            <PluginLogo id={grant.markId} className="size-9 rounded-[10px]" />
          ) : undefined
        }
        actions={
          continueUrl ? (
            <a
              href={continueUrl}
              rel="noreferrer"
              target="_blank"
              className={cn(
                inkButton,
                "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
              )}
            >
              Continue to sign in
            </a>
          ) : data.state === "required" && data.userCode ? (
            <span className="text-muted-foreground text-xs">
              Code:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                {data.userCode}
              </code>
            </span>
          ) : undefined
        }
      />
    );
  },
});
