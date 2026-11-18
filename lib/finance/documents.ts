export type DocumentKind =
  | "passport"
  | "drivers_license"
  | "voter_registration"
  | "other";

export type DocumentStatus = "overdue" | "due_soon" | "current" | "no_date";

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  passport: "Passport",
  drivers_license: "Driver’s license",
  voter_registration: "Voter registration",
  other: "Other",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  current: "Current",
  no_date: "No date",
};

/** Lead window in days before renewsOn when status becomes due_soon. */
export const DOCUMENT_LEAD_DAYS: Record<DocumentKind, number> = {
  passport: 180,
  drivers_license: 90,
  voter_registration: 60,
  other: 90,
};

export const VEHICLE_REGISTRATION_LEAD_DAYS = 60;

export function isDocumentKind(value: string): value is DocumentKind {
  return value in DOCUMENT_KIND_LABELS;
}

export function documentLeadDays(kind: string): number {
  if (isDocumentKind(kind)) return DOCUMENT_LEAD_DAYS[kind];
  return DOCUMENT_LEAD_DAYS.other;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function documentStatus(
  renewsOn: Date | null | undefined,
  leadDays: number,
  now: Date = new Date(),
): DocumentStatus {
  if (!renewsOn) return "no_date";
  const days = daysBetween(now, renewsOn);
  if (days < 0) return "overdue";
  if (days <= leadDays) return "due_soon";
  return "current";
}

export function personalDocumentStatus(
  kind: string,
  renewsOn: Date | null | undefined,
  now: Date = new Date(),
): DocumentStatus {
  return documentStatus(renewsOn, documentLeadDays(kind), now);
}

export function vehicleRegistrationStatus(
  renewsOn: Date | null | undefined,
  now: Date = new Date(),
): DocumentStatus {
  return documentStatus(renewsOn, VEHICLE_REGISTRATION_LEAD_DAYS, now);
}

/** Sort: overdue first, then soonest renewsOn, then undated last. */
export function compareByRenewalUrgency(
  a: { renewsOn: Date | null; status: DocumentStatus },
  b: { renewsOn: Date | null; status: DocumentStatus },
): number {
  const rank: Record<DocumentStatus, number> = {
    overdue: 0,
    due_soon: 1,
    current: 2,
    no_date: 3,
  };
  const byStatus = rank[a.status] - rank[b.status];
  if (byStatus !== 0) return byStatus;
  if (a.renewsOn && b.renewsOn) {
    return a.renewsOn.getTime() - b.renewsOn.getTime();
  }
  if (a.renewsOn) return -1;
  if (b.renewsOn) return 1;
  return 0;
}

/** True when Home Upcoming should surface this document. */
export function shouldShowDocumentInUpcoming(
  kind: string,
  renewsOn: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const status = personalDocumentStatus(kind, renewsOn, now);
  return status === "overdue" || status === "due_soon";
}
