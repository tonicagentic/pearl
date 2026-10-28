import { Redirect } from "expo-router";

import { AppsScreen } from "@/components/apps-screen";
import { useAuth } from "@/src/auth";

export default function Apps() {
  const { signedIn, restoring } = useAuth();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  return <AppsScreen />;
}
