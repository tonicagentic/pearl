import { makeAssistantDataUI } from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

type AuthorizationData = {
  state: "required" | "completed";
  name: string;
  displayName?: string;
  description?: string;
  instructions?: string;
  userCode?: string;
  url?: string;
  outcome?: string;
  reason?: string;
};

function AuthorizationCard({ data }: { data: AuthorizationData }) {
  const [copied, setCopied] = useState(false);
  const open = () => {
    if (!data.url || !/^https:\/\//i.test(data.url)) return;
    void Linking.openURL(data.url).catch(() => Alert.alert("Could not open sign-in link"));
  };
  return (
    <View className="border-border bg-card my-2 gap-2 rounded-xl border p-3">
      {data.state === "required" ? (
        <>
          <Text className="text-foreground text-sm font-medium">
            {data.instructions ?? `Sign in to ${data.displayName ?? data.name}`}
          </Text>
          {data.userCode ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy authorization code"
              className="min-h-11 justify-center"
              onPress={() => void Clipboard.setStringAsync(data.userCode!).then(() => setCopied(true)).catch(() => Alert.alert("Could not copy code"))}
            >
              <Text className="text-foreground text-sm">Code: {data.userCode} {copied ? "· Copied" : "· Tap to copy"}</Text>
            </Pressable>
          ) : null}
          {data.url ? (
            <Pressable accessibilityRole="link" className="min-h-11 justify-center" onPress={open}>
              <Text className="text-primary text-sm font-medium">Continue to sign in</Text>
            </Pressable>
          ) : null}
          <Text className="text-muted-foreground text-xs">
            Return here after sign-in. The chat will update when authorization completes.
          </Text>
        </>
      ) : (
        <Text className="text-muted-foreground text-sm">{data.outcome ?? "Authorization completed"}</Text>
      )}
    </View>
  );
}

// A registration component: the runtime mounts the card for projected data parts.
export const EveAuthorization = makeAssistantDataUI<AuthorizationData>({
  name: "authorization",
  render: ({ data }) => <AuthorizationCard data={data} />,
});
