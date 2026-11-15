import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
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
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

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
    <SafeAreaView
      style={[styles.root, { backgroundColor }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          gap: 20,
          paddingHorizontal: 24,
          paddingBottom: 28,
          paddingTop: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="min-h-11 justify-center"
            disabled={busy !== null}
            onPress={onBack}
          >
            <Text variant="label" tone="muted">
              ‹ Back
            </Text>
          </Pressable>
        ) : null}
        <Text variant="title" className="text-center tracking-tight">
          {title}
        </Text>
        <Text variant="body" tone="muted" className="leading-[22px]">
          Deploy the open-source Pearl agent on Vercel, then point this app at
          your deployment instead of the hosted service.
        </Text>

        <View style={styles.section}>
          <Text variant="label" weight="semibold">
            1. Deploy on Vercel
          </Text>
          <Text variant="body" tone="muted" className="leading-[22px]">
            Fork or clone the Pearl repo, create a Vercel project, and deploy.
            For a quick start set{" "}
            <Text variant="caption" className="font-mono">
              EVE_CHAT_PASSWORD
            </Text>{" "}
            (16+ characters). To skip Stripe billing on your install, set{" "}
            <Text variant="caption" className="font-mono">
              PEARL_BILLING=off
            </Text>
            .
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => openWebUrlExternally(REPO_URL)}
            style={styles.linkRow}
          >
            <Text variant="body" weight="semibold" className="underline">
              Open GitHub repo
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => openWebUrlExternally(SETUP_DOCS_URL)}
            style={styles.linkRow}
          >
            <Text variant="body" weight="semibold" className="underline">
              Setup and deploy docs
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text variant="label" weight="semibold">
            2. Connect this app
          </Text>
          <Text variant="body" tone="muted" className="leading-[22px]">
            Paste your deployment URL (for example{" "}
            <Text variant="caption" className="font-mono">
              https://your-app.vercel.app
            </Text>
            ). Pearl will sign you into that agent instead of the paid host.
          </Text>
          <TextField
            accessibilityLabel="Agent URL"
            autoCapitalize="none"
            autoCorrect={false}
            editable={busy === null}
            keyboardType="url"
            onChangeText={setUrl}
            placeholder="https://your-app.vercel.app"
            returnKeyType="done"
            textContentType="URL"
            value={url}
            onSubmitEditing={() => void connect()}
          />
          <Text variant="caption">
            Currently using {agentHostname(AGENT_URL)}
          </Text>
        </View>

        {error ? (
          <Text
            accessibilityRole="alert"
            variant="secondary"
            tone="destructive"
          >
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Connect"
            loading={busy === "connect"}
            loadingLabel="Connecting…"
            disabled={busy !== null}
            onPress={() => void connect()}
          />
          <Button
            label="Use hosted Pearl"
            variant="secondary"
            loading={busy === "hosted"}
            loadingLabel="Switching…"
            disabled={busy !== null}
            onPress={() => void useHosted()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: { gap: 10 },
  linkRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  actions: { gap: 10, marginTop: 4 },
});
