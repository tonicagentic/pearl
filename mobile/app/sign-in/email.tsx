import { ObserveInteractiveMarker } from "@/src/observe";

import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";

/**
 * Email / password steps — native push from the auth gate, with a liquid-glass
 * Toolbar back control on iOS.
 */
export default function SignInEmailRoute() {
  const { restoring } = useAuth();

  if (restoring) {
    return null;
  }

  return (
    <>
      <SignInScreen variant="email" />
      <ObserveInteractiveMarker />
    </>
  );
}
