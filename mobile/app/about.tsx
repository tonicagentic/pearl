import { Redirect } from "expo-router";

import { AboutScreen } from "@/components/about-screen";
import { useAuth } from "@/src/auth";

/** About Pearl settings route; requires the auth gate (redirects home otherwise). */
export default function About() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <AboutScreen />;
}
