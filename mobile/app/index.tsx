import { StyleSheet, View } from "react-native";

import { AuthToChatMorph } from "@/components/auth-to-chat-morph";
import { ChatScreen } from "@/components/chat-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";

/** The chat route: the sign-in gate when signed out, the thread when in. */
export default function Index() {
  const { signedIn, restoring, authHandOff, completeAuthHandOff } = useAuth();

  if (restoring) {
    // Keychain session check in flight: render nothing rather than flashing
    // the sign-in screen for a signed-in user.
    return null;
  }

  if (!signedIn) {
    return <SignInScreen />;
  }

  return (
    <View style={styles.fill}>
      {/* Hide welcome/composer while the CTA morph overlay owns the transition. */}
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
