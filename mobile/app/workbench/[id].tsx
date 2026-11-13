import { Redirect } from "expo-router";

import { WorkbenchDetailScreen } from "@/components/workbench-detail-screen";
import { useAuth } from "@/src/auth";

export default function WorkbenchDetailRoute() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <WorkbenchDetailScreen />;
}
