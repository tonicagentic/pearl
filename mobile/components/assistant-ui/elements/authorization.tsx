import { makeAssistantDataUI } from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { PluginLogo } from "@/components/settings/plugin-logo";
import { authorizationGrantView } from "../../../../lib/chat/authorization-grant";
import { cn } from "@/lib/utils";
import { inkButton } from "./surfaces";
import { PermissionGrant } from "./permission-grant";

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
  const grant = authorizationGrantView(data);
  const continueUrl =
    data.state === "required" && data.url && /^https:\/\//i.test(data.url)
      ? data.url
      : undefined;

  const open = () => {
    if (!continueUrl) return;
    void Linking.openURL(continueUrl).catch(() =>
      Alert.alert("Could not open sign-in link"),
    );
  };

  const actions =
    continueUrl != null ? (
      <Pressable
        accessibilityRole="link"
        onPress={open}
        className={cn(
          inkButton,
          "h-8 items-center justify-center rounded-full px-3",
        )}
      >
        <Text variant="caption" weight="medium" className="text-background">
          Continue to sign in
        </Text>
      </Pressable>
    ) : data.state === "required" && data.userCode ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy authorization code"
        className="min-h-8 justify-center"
        onPress={() =>
          void Clipboard.setStringAsync(data.userCode!)
            .then(() => setCopied(true))
            .catch(() => Alert.alert("Could not copy code"))
        }
      >
        <Text variant="caption" tone="default" className="opacity-70">
          Code: {data.userCode} {copied ? "· Copied" : "· Tap to copy"}
        </Text>
      </Pressable>
    ) : undefined;

  return (
    <View className="w-full">
      <PermissionGrant
        capability={grant.capability}
        reach={grant.reach}
        scope={grant.scope}
        icon={
          grant.markId ? <PluginLogo id={grant.markId} size={36} /> : undefined
        }
        actions={actions}
      />
    </View>
  );
}

// A registration component: the runtime mounts the card for projected data parts.
export const EveAuthorization = makeAssistantDataUI<AuthorizationData>({
  name: "authorization",
  render: ({ data }) => <AuthorizationCard data={data} />,
});
