import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AuthToChatMorph } from "@/components/auth-to-chat-morph";
import { ChatScreen } from "@/components/chat-screen";
import { useAuth } from "@/src/auth";

/** Nested chat thread — pushed on top of home so swipe-back returns to recents. */
export default function ChatRoute() {
  const {
    restoring,
    signedIn,
    billingReady,
    authHandOff,
    completeAuthHandOff,
  } = useAuth();

  if (restoring) return null;
  if (!signedIn || !billingReady) return <Redirect href="/" />;

  return (
    <View style={styles.fill}>
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
