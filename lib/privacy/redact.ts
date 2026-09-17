// Private-data classification for third-party egress.
//
// The unit tier pins: every egress path must classify its payload and refuse
// (or strip) private data classes the tool is not allowlisted for. Failing
// closed is the default: send-like tools reject the call, read-like tools
// strip the private fragment before the request leaves the process.

export type PrivacyClass =
  | "health"
  | "financial"
  | "credential"
  | "identifier";

const PATTERNS: Readonly<Record<PrivacyClass, RegExp>> = {
  health:
    /\b(hiv|aids|cancer|pregnan\w*|antidepress\w*|diagnos\w*|prescription|disability|therapy|psychiatric|hiv\+|bipolar|chemo)\b/i,
  financial:
    /\b(iban|swift|routing number|account number|salary|income|debt|bankruptcy|credit card|cvv|tax return)\b|\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/i,
  credential:
    /\b(api[- ]?key|access token|refresh token|private key|secret|password|passwd|one[- ]?time code|otp)\b|\b(sk-[a-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/i,
  identifier:
    /\b(ssn|social security|passport|national id|driver'?s licen[cs]e|date of birth|dob)\b|\b\d{3}-\d{2}-\d{4}\b/i,
};

export const CLASS_LABELS: Readonly<Record<PrivacyClass, string>> = {
  health: "health information",
  financial: "financial data",
  credential: "credentials or secrets",
  identifier: "government identifiers",
};

/** Classes detected in the payload, or [] when clean. */
export function detectPrivateClasses(text: string): PrivacyClass[] {
  return (Object.keys(PATTERNS) as PrivacyClass[]).filter((cls) =>
    PATTERNS[cls].test(text),
  );
}

export type EgressCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly classes: readonly PrivacyClass[];
      readonly reason: string;
    };

/** Gate an outbound payload against the data classes the tool may carry.
 * `allowed` names the classes THIS tool is allowlisted to carry. Fails closed
 * with a reason the model (and the audit log) can act on. */
export function checkEgress(
  payload: string,
  options: { allowed?: readonly PrivacyClass[] } = {},
): EgressCheck {
  const allowed = options.allowed ?? [];
  const found = detectPrivateClasses(payload).filter(
    (cls) => !allowed.includes(cls),
  );

  if (found.length === 0) {
    return { ok: true };
  }

  const labels = found.map((cls) => CLASS_LABELS[cls]).join(", ");

  return {
    ok: false,
    classes: found,
    reason: `Refused to send private context (${labels}) to a third party. Ask the user to share only what is needed, or use a channel allowlisted for this data.`,
  };
}
