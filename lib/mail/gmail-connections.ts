/**
 * Gmail no longer uses an MCP connection. Mailboxes are Connect OAuth grants
 * consumed by first-party REST tools under agent/tools/*gmail*.
 * Re-export slug helpers for Settings / status copy.
 */

export { gmailConnectionSlug } from "@/lib/mail/subjects";
