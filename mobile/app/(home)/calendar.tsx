import { CalendarScreen } from "@/components/settings/calendar-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Calendar accounts settings route; requires the auth gate. */
export default function CalendarRoute() {
  return (
    <RequireSignedIn>
      <CalendarScreen />
    </RequireSignedIn>
  );
}
