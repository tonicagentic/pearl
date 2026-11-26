/** Shared error formatting for reconnect / eve client surfaces. */

export function errorSummary(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message.slice(0, 240);
  if (typeof error === "string") return error.slice(0, 240);
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message).slice(0, 240);
  }
  return "unknown";
}
