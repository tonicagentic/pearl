import { isEmailOnTrialAllowlist } from "@/lib/billing/config";

export const SIGNUP_NOT_INVITED_MESSAGE =
  "This beta is invite-only. Ask Alex to add your email.";

/** True when email/password sign-up may create a new account. */
export function isSignUpEmailAllowed(email: string): boolean {
  return isEmailOnTrialAllowlist(email);
}
