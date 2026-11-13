import { Redirect } from "expo-router";

import { WorkbenchScreen } from "@/components/workbench-screen";
import { useAuth } from "@/src/auth";

export default function WorkbenchRoute() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <WorkbenchScreen />;
}
