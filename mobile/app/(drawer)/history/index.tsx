import { ChatHistoryScreen } from "@/components/history/chat-history-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function History() {
  return (
    <RequireSignedIn>
      <ChatHistoryScreen />
    </RequireSignedIn>
  );
}
