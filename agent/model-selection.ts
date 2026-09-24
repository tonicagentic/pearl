// Client-driven model selection for the composer model picker.
//
// The picker (app/_components/model-picker.tsx) attaches its selection to each
// send as clientContext: { eveModelSelection: "<key>" }. The context rides the
// turn as an ephemeral user-role message, which the step.started model
// resolver reads from ctx.messages (agent/agent.ts).
//
// Values are picker keys, not gateway ids: the allowlist below is the only
// path from a client-supplied string to a model id, so an arbitrary client
// payload can never select an unreviewed model.

export const DEFAULT_MODEL = "zai/glm-5.3-flash";

export const CLIENT_MODEL_KEYS = {
  "glm-5.3-flash": "zai/glm-5.3-flash",
  "gpt-6-sol": "openai/gpt-6-sol",
} as const;

export type ClientModelKey = keyof typeof CLIENT_MODEL_KEYS;

export const MODEL_SELECTION_MARKER = "eveModelSelection";

interface ScannedMessage {
  role: string;
  content: unknown;
  kind?: unknown;
}

export type ScannedMessageLike = readonly ScannedMessage[];

// Scan a turn's messages (newest first) for the clientContext marker and
// return the gateway model id it selects, or undefined when absent or unknown.
//
// eve serializes a JSON-object clientContext into an ephemeral framework user
// message of kind "context.instruction", rendered as:
//
//   Client context:
//   {"eveModelSelection":"gpt-6-sol"}
//
// Regular user messages never carry that kind, so prose quoting the marker is
// ignored. The captured value must be an allowlisted picker key.
export function readClientModelSelection(
  messages: readonly ScannedMessage[],
): string | undefined {
  const markerPattern = new RegExp(
    `"${MODEL_SELECTION_MARKER}"\\s*:\\s*"([^"]+)"`,
  );
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (message.kind !== "context.instruction") continue;
    if (typeof message.content !== "string") continue;
    const match = message.content.match(markerPattern);
    if (!match) continue;
    const key = match[1];
    if (key in CLIENT_MODEL_KEYS) {
      return CLIENT_MODEL_KEYS[key as ClientModelKey];
    }
  }
  return undefined;
}
