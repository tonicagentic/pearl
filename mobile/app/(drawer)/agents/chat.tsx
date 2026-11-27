import { Redirect } from "expo-router";

/** Agent threads now open on the home chat stack. */
export default function AgentsChatRoute() {
  return <Redirect href="/chat" />;
}
