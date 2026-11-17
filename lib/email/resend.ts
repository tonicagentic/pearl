import { Resend } from "resend";

const DEFAULT_FROM = "Pearl <noreply@tonicagentic.com>";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}

/** Send a transactional email via Resend. Throws if the API key is missing. */
export async function sendEmail(options: {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}): Promise<void> {
  const client = getResendClient();
  if (!client) {
    throw new Error(
      "RESEND_API_KEY is not set. Install the Resend marketplace integration.",
    );
  }

  const { error } = await client.emails.send({
    from: getFromAddress(),
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email via Resend.");
  }
}

/** Password-reset mail used by Better Auth's sendResetPassword hook. */
export async function sendPasswordResetEmail(options: {
  readonly to: string;
  readonly url: string;
}): Promise<void> {
  const text = [
    "Reset your Pearl password",
    "",
    "Click the link below to choose a new password. This link expires in one hour.",
    "",
    options.url,
    "",
    "If you did not request a reset, you can ignore this email.",
  ].join("\n");

  const html = `
    <p>Reset your Pearl password</p>
    <p><a href="${options.url}">Choose a new password</a></p>
    <p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>
  `.trim();

  await sendEmail({
    to: options.to,
    subject: "Reset your Pearl password",
    text,
    html,
  });
}

/** Email verification / change confirmation used by Better Auth. */
export async function sendVerificationLinkEmail(options: {
  readonly to: string;
  readonly url: string;
  readonly subject?: string;
}): Promise<void> {
  const subject = options.subject ?? "Verify your Pearl email";
  const text = [
    subject,
    "",
    "Click the link below to continue. This link expires in one hour.",
    "",
    options.url,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <p>${subject}</p>
    <p><a href="${options.url}">Continue</a></p>
    <p>This link expires in one hour. If you did not request this, you can ignore this email.</p>
  `.trim();

  await sendEmail({
    to: options.to,
    subject,
    text,
    html,
  });
}
