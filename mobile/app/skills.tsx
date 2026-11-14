import { SkillsScreen } from "@/components/settings/skills-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Skills settings route; requires the auth gate (redirects home otherwise). */
export default function Skills() {
  return (
    <RequireSignedIn>
      <SkillsScreen />
    </RequireSignedIn>
  );
}
