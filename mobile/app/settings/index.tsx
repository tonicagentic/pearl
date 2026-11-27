import { SettingsScreen } from "@/components/settings/settings-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function Settings() {
  return (
    <RequireSignedIn>
      <SettingsScreen />
    </RequireSignedIn>
  );
}
