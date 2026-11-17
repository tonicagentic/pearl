import { useState } from "react";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsSection,
} from "@/components/settings/native";
import { agentHostname, normalizeAgentUrlInput } from "@/src/agent-url";
import {
  AGENT_URL,
  applyAgentUrl,
  isCustomAgentUrl,
  resetAgentUrl,
} from "@/src/eve-transport";
import { openWebUrlExternally } from "@/src/open-web-url";

const REPO_URL = "https://github.com/tonicagentic/pearl";
const SETUP_DOCS_URL =
  "https://github.com/tonicagentic/pearl/blob/main/docs/setup-and-deploy.md";

/**
 * Deploy + connect your own eve agent. Used from the signed-out intro and
 * Settings → Self-host.
 */
export function SelfHostScreen({
  onConnected,
  onUseHosted,
  onBack,
  title = "Self-host Pearl",
}: {
  /** After a custom agent URL is saved (session cleared). */
  readonly onConnected: () => void;
  /** After resetting to the hosted Pearl agent. */
  readonly onUseHosted: () => void;
  /** Optional return to the prior step (signed-out intro). */
  readonly onBack?: () => void;
  readonly title?: string;
}) {
  const [url, setUrl] = useState(() => (isCustomAgentUrl() ? AGENT_URL : ""));
  const [busy, setBusy] = useState<"connect" | "hosted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setError(null);
    setBusy("connect");
    try {
      const normalized = normalizeAgentUrlInput(url);
      await applyAgentUrl(normalized);
      onConnected();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const useHosted = async () => {
    setError(null);
    setBusy("hosted");
    try {
      await resetAgentUrl();
      onUseHosted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          Deploy the open-source Pearl agent on Vercel, then point this app at
          your deployment instead of the hosted service.
        </SettingsFormText>
      }
    >
      {onBack ? (
        <SettingsSection>
          <SettingsButton
            disabled={busy !== null}
            label="Back"
            onPress={onBack}
            variant="plain"
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={title}>
        <SettingsFormText>
          1. Deploy on Vercel — fork or clone the Pearl repo, create a Vercel
          project, and deploy. For a quick start set EVE_CHAT_PASSWORD (16+
          characters). To skip Stripe billing on your install, set
          PEARL_BILLING=off.
        </SettingsFormText>
      </SettingsSection>

      <SettingsSection>
        <SettingsButton
          label="Open GitHub repo"
          onPress={() => openWebUrlExternally(REPO_URL)}
          variant="plain"
        />
        <SettingsButton
          label="Setup and deploy docs"
          onPress={() => openWebUrlExternally(SETUP_DOCS_URL)}
          variant="plain"
        />
      </SettingsSection>

      <SettingsSection
        title="2. Connect this app"
        footer={
          <SettingsFormText tone="secondary">
            {`Currently using ${agentHostname(AGENT_URL)}`}
          </SettingsFormText>
        }
      >
        <SettingsField
          label="Agent URL"
          onChangeText={setUrl}
          placeholder="https://your-app.vercel.app"
          value={url}
        />
      </SettingsSection>

      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection>
        <SettingsButton
          disabled={busy !== null}
          label={busy === "connect" ? "Connecting…" : "Connect"}
          onPress={() => void connect()}
        />
        <SettingsButton
          disabled={busy !== null}
          label={busy === "hosted" ? "Switching…" : "Use hosted Pearl"}
          onPress={() => void useHosted()}
        />
      </SettingsSection>
    </SettingsForm>
  );
}
