import { Redirect } from "expo-router";

import { AreasScreen } from "@/components/areas-screen";
import { useAuth } from "@/src/auth";

export default function Areas() {
  const { signedIn, restoring } = useAuth();
  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;
  return <AreasScreen />;
}
