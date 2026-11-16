import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AuthToChatMorph } from "@/components/auth-to-chat-morph";
import { ChatScreen } from "@/components/chat-screen";
import { useAuth } from "@/src/auth";

/** Nested chat thread — pushed on top of home so swipe-back returns to recents. */
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
  }>();
  const settleFromHome = params.settle === "1" || params.guestEntry === "1";

  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          animation: settleFromHome || authHandOff ? "none" : undefined,
        }}
      />
      <ChatScreen chromeRevealed={!authHandOff} />
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
