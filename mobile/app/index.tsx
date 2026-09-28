import { SignInScreen } from "@/components/sign-in-screen";
import { ChatScreen } from "@/components/chat-screen";
import { useAuth } from "@/src/auth";

/** The chat route: the sign-in gate when signed out, the thread when in. */
export default function Index() {
  const { signedIn } = useAuth();

  return signedIn ? <ChatScreen /> : <SignInScreen />;
}
