import { useCallback, useEffect, useState } from "react";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsSection,
  SettingsSecureField,
} from "@/components/settings/native";
import {
  createConnectedAgent,
  deleteConnectedAgent,
  listConnectedAgents,
  type ConnectedAgentSummary,
} from "@/src/connected-agents-client";
import { setConnectedAgentsCache } from "@/src/remote-agent-selection";

/** Settings → Connected agents: link private eve deployments. */
export function ConnectedAgentsScreen() {
  const [agents, setAgents] = useState<ConnectedAgentSummary[]>([]);
  const [available, setAvailable] = useState(true);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConnectedAgents();
      setAgents(data.agents);
      setAvailable(data.available);
      setConnectedAgentsCache(data.agents);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load agents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await createConnectedAgent({ label, url, token });
      setAgents(data.agents);
      setConnectedAgentsCache(data.agents);
      setLabel("");
      setUrl("");
      setToken("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not connect agent.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (agentId: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await deleteConnectedAgent(agentId);
      setAgents(next);
      setConnectedAgentsCache(next);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not remove agent.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsForm
      footer={
        <SettingsFormText tone="secondary">
          Pearl calls these as remote agents. Keep private agent code in its own
          repo. Use an https URL and a bearer the private eve channel accepts.
        </SettingsFormText>
      }
    >
      {!available ? (
        <SettingsFormText tone="destructive">
          Connected agents need USER_SECRETS_KEY on this deployment.
        </SettingsFormText>
      ) : null}

      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}

      <SettingsSection title="Add agent">
        <SettingsField
          label="Name"
          onChangeText={setLabel}
          placeholder="Finance agent"
          value={label}
        />
        <SettingsField
          label="Agent URL"
          onChangeText={setUrl}
          placeholder="https://my-agent.vercel.app"
          value={url}
        />
        <SettingsSecureField
          label="Bearer token"
          onChangeText={setToken}
          placeholder="Token for the private agent"
          value={token}
        />
        <SettingsButton
          disabled={
            busy ||
            !available ||
            !label.trim() ||
            !url.trim() ||
            !token.trim()
          }
          label={busy ? "Connecting…" : "Connect"}
          onPress={() => void connect()}
        />
      </SettingsSection>

      <SettingsSection
        title="Your agents"
        footer={
          loading ? (
            <SettingsFormText tone="secondary">Loading…</SettingsFormText>
          ) : agents.length === 0 ? (
            <SettingsFormText tone="secondary">
              No connected agents yet.
            </SettingsFormText>
          ) : undefined
        }
      >
        {agents.map((agent) => (
          <SettingsLabeledValue
            key={`${agent.id}-label`}
            label={agent.label}
            value={agent.url}
          />
        ))}
        {agents.map((agent) => (
          <SettingsButton
            key={`${agent.id}-remove`}
            disabled={busy}
            destructive
            label={`Remove ${agent.label}`}
            onPress={() => void remove(agent.id)}
            variant="plain"
          />
        ))}
        <SettingsButton
          disabled={loading || busy}
          label={loading ? "Loading…" : "Refresh"}
          onPress={() => void load()}
          variant="plain"
        />
      </SettingsSection>
    </SettingsForm>
  );
}
