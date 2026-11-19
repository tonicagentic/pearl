"use client";

import { useState } from "react";

import { useActiveCustomAgent } from "@/components/custom-agents/active-custom-agent-context";
import { AgentIdentityPill } from "@/components/custom-agents/agent-identity-pill";
import { AgentSettingsDialog } from "@/components/custom-agents/agent-settings-dialog";

/** Web thread attachment: identity pill that opens agent settings. */
export function AgentThreadChrome() {
  const { agent } = useActiveCustomAgent();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!agent) return null;

  return (
    <>
      <div className="pointer-events-auto">
        <AgentIdentityPill
          name={agent.name}
          accent={agent.accent}
          markShape={agent.markShape}
          markTalk={agent.markTalk}
          motion="idle"
          onClick={() => setSettingsOpen(true)}
        />
      </div>
      <AgentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}
