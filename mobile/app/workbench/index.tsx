import { Redirect } from "expo-router";

import { WorkbenchScreen } from "@/components/workbench-screen";
import { useAuth } from "@/src/auth";

export default function WorkbenchRoute() {
  const { signedIn, restoring } = useAuth();
  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;
  return <WorkbenchScreen />;
}
