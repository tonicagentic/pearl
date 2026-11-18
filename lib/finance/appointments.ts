export type AppointmentKind =
  | "visit"
  | "dental"
  | "vision"
  | "procedure"
  | "lab"
  | "therapy"
  | "hair"
  | "personal_care"
  | "other";

export type AppointmentStatus =
  | "planned"
  | "scheduled"
  | "done"
  | "cancelled";

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  visit: "Visit",
  dental: "Dental",
  vision: "Vision",
  procedure: "Procedure",
  lab: "Lab",
  therapy: "Therapy",
  hair: "Hair",
  personal_care: "Personal care",
  other: "Other",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  planned: "Planned",
  scheduled: "Scheduled",
  done: "Done",
  cancelled: "Cancelled",
};

export function defaultAppointmentCategorySlug(kind: string): string {
  if (kind === "dental") return "dental-care";
  if (kind === "vision") return "vision-care";
  if (kind === "therapy") return "therapy";
  if (kind === "lab" || kind === "procedure") return "medical-care";
  if (kind === "hair") return "hair";
  if (kind === "personal_care") return "personal-care";
  return "medical-care";
}

export function isUpcomingAppointmentStatus(status: string) {
  return status === "planned" || status === "scheduled";
}
