import { EmailScreen } from "@/components/settings/email-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Email accounts settings route; requires the auth gate. */
export default function EmailRoute() {
  return (
    <RequireSignedIn>
      <EmailScreen />
    </RequireSignedIn>
  );
}
