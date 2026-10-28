import { Redirect, useLocalSearchParams } from "expo-router";

import { AppViewerScreen } from "@/components/app-viewer-screen";
import { useAuth } from "@/src/auth";

export default function AppViewer() {
  const { signedIn, restoring } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  if (!id || typeof id !== "string") {
    return <Redirect href="/apps" />;
  }

  return <AppViewerScreen id={id} />;
}
