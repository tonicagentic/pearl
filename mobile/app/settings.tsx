import { Redirect } from "expo-router";

import { SettingsScreen } from "@/components/settings-screen";
import { useAuth } from "@/src/auth";

export default function Settings() {
  const { restoring, signedIn } = useAuth();
  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;
  return <SettingsScreen />;
}
