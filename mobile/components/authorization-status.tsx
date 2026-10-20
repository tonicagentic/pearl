import { useState } from "react";
import * as Linking from "expo-linking";
import { Pressable, Text, View } from "react-native";
import type { AuthorizationEvent } from "@/src/authorization-events";

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function AuthorizationStatus({ event, onNewChat, onResume, canResume }: { event: AuthorizationEvent; onNewChat: () => void; onResume: () => Promise<void>; canResume: boolean }) {
  const [openError, setOpenError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const challenge = event.data.authorization;
  const url = httpsUrl(challenge?.url);
  const pending = event.type === "authorization.required";
  const label = challenge?.displayName || event.data.name;
  const open = async () => {
    if (!url) return;
    setOpenError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setOpenError("Could not open the authorization link. Try again later.");
    }
  };
  const resume = async () => {
    if (checking || !canResume) return;
    setChecking(true);
    setOpenError(null);
    try {
      // Reattach to the same eve session after the external OAuth callback.
      // This never sends another user message or grants access on its own.
      await onResume();
    } catch {
      setOpenError("Could not refresh this chat. Try again later.");
    } finally {
      setChecking(false);
    }
  };
  return (
    <View className="mx-4 my-3 gap-2 rounded-xl border border-border bg-muted/40 p-4">
      <Text className="text-base font-semibold text-foreground">{label} authorization {pending ? "required" : "completed"}</Text>
      {pending ? (
        <>
          <Text className="text-sm text-foreground">{event.data.description}</Text>
          {challenge?.instructions ? <Text className="text-sm text-muted-foreground">{challenge.instructions}</Text> : null}
          {challenge?.userCode ? <Text selectable className="text-base font-semibold text-foreground">Code: {challenge.userCode}</Text> : null}
          {url ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${label} authorization page`} onPress={() => void open()} className="min-h-11 self-start justify-center rounded-lg border border-border px-4">
              <Text className="font-medium text-foreground">Open authorization page</Text>
            </Pressable>
          ) : challenge?.url ? <Text className="text-sm text-destructive">The authorization link is not a valid HTTPS URL.</Text> : null}
          <Text className="text-xs text-muted-foreground">After completing authorization, the active chat follows the result automatically. If it has stopped, refresh this chat. You can also start another chat while this one waits.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh authorization status" disabled={checking || !canResume} onPress={() => void resume()} className="min-h-11 self-start justify-center rounded-lg border border-border px-4 disabled:opacity-50">
            <Text className="text-sm font-medium text-foreground">{checking ? "Refreshing…" : canResume ? "Refresh chat" : "Waiting for authorization…"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Start another chat" onPress={onNewChat} className="min-h-11 self-start justify-center px-2">
            <Text className="text-sm font-medium text-foreground">Start another chat</Text>
          </Pressable>
          {openError ? <Text accessibilityRole="alert" className="text-sm text-destructive">{openError}</Text> : null}
        </>
      ) : (
        <>
          <Text className="text-sm text-foreground">Outcome: {event.data.outcome}</Text>
          {event.data.reason ? <Text className="text-sm text-muted-foreground">{event.data.reason}</Text> : null}
        </>
      )}
    </View>
  );
}
