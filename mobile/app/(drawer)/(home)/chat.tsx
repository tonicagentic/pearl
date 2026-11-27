import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AuthToChatMorph } from "@/components/auth-to-chat-morph";
import { ChatScreen } from "@/components/chat-screen";
import { useAuth } from "@/src/auth";
import type { ProjectEntryFrom } from "@/src/overview-ui";

function parseEntryFrom(raw: string | undefined): ProjectEntryFrom {
  if (raw === "overview" || raw === "drawer") return raw;
  return undefined;
}

/** Nested chat thread — pushed on the home stack (agents / History / projects). */
export default function ChatRoute() {
  const {
    restoring,
    signedIn,
    authHandOff,
    completeAuthHandOff,
  } = useAuth();
  const params = useLocalSearchParams<{
    settle?: string;
    guestEntry?: string;
    returnProject?: string;
    from?: string;
  }>();
  const settleFromHome = params.settle === "1" || params.guestEntry === "1";
  const returnProjectId =
    typeof params.returnProject === "string" && params.returnProject.trim()
      ? params.returnProject.trim()
      : null;
  const returnEntryFrom = parseEntryFrom(
    typeof params.from === "string" ? params.from : undefined,
  );

  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          animation: settleFromHome || authHandOff ? "none" : undefined,
        }}
      />
      <ChatScreen
        chromeRevealed={!authHandOff}
        returnProjectId={returnProjectId}
        returnEntryFrom={returnEntryFrom}
      />
      {authHandOff ? (
        <AuthToChatMorph
          from={authHandOff.from}
          onComplete={completeAuthHandOff}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
