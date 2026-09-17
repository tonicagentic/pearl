// Context builders that tell the agent who it is talking to and when it is
// speaking. Kept pure and dependency-free so the unit tier runs them with
// plain `node --test`; the dynamic instruction modules in agent/instructions/
// are thin wrappers around these.

export type CallerIdentity = {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly principalId?: string | null;
};

/**
 * System-role text introducing the caller. Null contributes nothing (eve
 * dynamic instructions may return null to omit the capability).
 */
export function callerIdentity(
  principal: CallerIdentity | null | undefined,
): string | null {
  const name = principal?.name?.trim();
  const email = principal?.email?.trim();
  const principalId = principal?.principalId?.trim();

  if (!name && !email && !principalId) {
    return null;
  }

  const lines = [
    "# Who you are talking to",
    "",
    "The signed-in person in this conversation:",
    name ? `- Name: ${name}` : null,
    email ? `- Email: ${email}` : null,
    principalId ? `- Principal id: ${principalId}` : null,
    "",
    "Use their name when it is natural. If a request would act on their data, this is the person whose data it is.",
  ];

  return lines.filter((line) => line !== null).join("\n");
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * User-context text pinning the current moment, refreshed per turn. Renders
 * UTC (the only timezone the runtime can assert) plus the weekday, so the
 * model never guesses the date from training priors.
 */
export function currentDatetime(now: Date = new Date()): string {
  const iso = now.toISOString();
  const [datePart, timePart] = iso.split("T");
  const clock = (timePart ?? "").slice(0, 8); // HH:MM:SS
  const weekday = WEEKDAYS[now.getUTCDay()];

  return [
    "# Current date and time",
    "",
    `It is ${weekday}, ${datePart}, and the current UTC time is ${clock} (${iso}).`,
    "Reason from this timestamp for anything time-sensitive (deadlines, \"today\", business hours). If the user's own timezone matters and is unknown, ask instead of guessing.",
  ].join("\n");
}
