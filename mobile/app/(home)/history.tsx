import { ChatHistoryScreen } from "@/components/home/chat-history-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function HistoryRoute() {
  return (
    <RequireSignedIn>
      <ChatHistoryScreen />
    </RequireSignedIn>
  );
}
