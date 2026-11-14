import { AboutScreen } from "@/components/intro/about-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** About Pearl settings route; requires the auth gate (redirects home otherwise). */
export default function About() {
  return (
    <RequireSignedIn>
      <AboutScreen />
    </RequireSignedIn>
  );
}
