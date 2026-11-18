/** Stable reply strings for answer-card confirm buttons (email / calendar / booking). */

export function emailDraftSaveMessage(props: {
  readonly to: string;
  readonly cc?: string | null;
  readonly bcc?: string | null;
  readonly subject: string;
  readonly body: string;
  readonly accountId?: string | null;
  readonly threadId?: string | null;
}): string {
  const parts = [
    "Save this email as a draft with create_gmail_draft:",
    `to=${props.to}`,
    props.cc ? `cc=${props.cc}` : null,
    props.bcc ? `bcc=${props.bcc}` : null,
    `subject=${props.subject}`,
    props.accountId ? `accountId=${props.accountId}` : null,
    props.threadId ? `threadId=${props.threadId}` : null,
    `body=${props.body}`,
  ];
  return parts.filter(Boolean).join("\n");
}

export function emailDraftSendMessage(props: {
  readonly to: string;
  readonly cc?: string | null;
  readonly bcc?: string | null;
  readonly subject: string;
  readonly body: string;
  readonly accountId?: string | null;
  readonly threadId?: string | null;
}): string {
  const parts = [
    "Send this email with send_gmail_message:",
    `to=${props.to}`,
    props.cc ? `cc=${props.cc}` : null,
    props.bcc ? `bcc=${props.bcc}` : null,
    `subject=${props.subject}`,
    props.accountId ? `accountId=${props.accountId}` : null,
    props.threadId ? `threadId=${props.threadId}` : null,
    `body=${props.body}`,
  ];
  return parts.filter(Boolean).join("\n");
}

export function emailBatchConfirmMessage(
  items: readonly {
    readonly accountId: string;
    readonly threadId: string;
    readonly action: "archive" | "mark_read";
    readonly subject?: string | null;
    readonly from?: string | null;
  }[],
): string {
  const lines = items.map((item, index) => {
    const bits = [
      `${index + 1}. accountId=${item.accountId}`,
      `threadId=${item.threadId}`,
      `action=${item.action}`,
      item.subject ? `subject=${item.subject}` : null,
      item.from ? `from=${item.from}` : null,
    ];
    return bits.filter(Boolean).join("; ");
  });
  return ["Apply this mail batch with apply_mail_batch:", ...lines].join("\n");
}

export function createEventConfirmMessage(props: {
  readonly title: string;
  readonly start: string;
  readonly end?: string | null;
  readonly location?: string | null;
  readonly calendarId?: string | null;
}): string {
  const parts = [
    "Add this event to my calendar:",
    `title=${props.title}`,
    `start=${props.start}`,
    props.end ? `end=${props.end}` : null,
    props.location ? `location=${props.location}` : null,
    props.calendarId ? `calendarId=${props.calendarId}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

export function createEventDiscardMessage(title: string): string {
  return `Discard creating the calendar event "${title}".`;
}

export function bookingConfirmMessage(props: {
  readonly restaurant?: string | null;
  readonly name?: string | null;
  readonly partySize: number;
  readonly date: string;
  readonly seating?: "indoor" | "patio" | null;
  readonly reminder?: boolean | null;
}): string {
  const parts = [
    "Confirm this table reservation:",
    props.restaurant ? `restaurant=${props.restaurant}` : null,
    props.name ? `name=${props.name}` : null,
    `partySize=${props.partySize}`,
    `date=${props.date}`,
    props.seating ? `seating=${props.seating}` : null,
    props.reminder != null ? `reminder=${props.reminder ? "yes" : "no"}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

export function bookingCancelMessage(restaurant: string | null | undefined): string {
  return restaurant
    ? `Cancel the table reservation at ${restaurant}.`
    : "Cancel this table reservation.";
}
