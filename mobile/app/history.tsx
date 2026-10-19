import { Redirect } from "expo-router";

import { HistoryScreen } from "@/components/app-drawer";
import { useAuth } from "@/src/auth";

export default function History() {
  const { restoring, signedIn } = useAuth();
  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;
  return <HistoryScreen />;
}
