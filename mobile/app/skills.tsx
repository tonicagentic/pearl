import { Redirect } from "expo-router";

import { SkillsScreen } from "@/components/skills-screen";
import { useAuth } from "@/src/auth";

/** Skills settings route; requires the auth gate (redirects home otherwise). */
export default function Skills() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <SkillsScreen />;
}
