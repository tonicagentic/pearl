import { SignInScreen } from "@/components/sign-in-screen";
import { ChatScreen } from "@/components/chat-screen";
import { useAuth } from "@/src/auth";

/** The chat route: the sign-in gate when signed out, the thread when in. */
export default function Index() {
  const { signedIn, restoring } = useAuth();

  if (restoring) {
    // Keychain session check in flight: render nothing rather than flashing
    // the sign-in screen for a signed-in user.
    return null;
  }

  return signedIn ? <ChatScreen /> : <SignInScreen />;
}
