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

export const DEFAULT_MODEL = "openai/gpt-6.1-sol";

// "auto" is the composer default: missing marker or the auto key both mean
// the parent-agent lane router chooses the model (agent/model-router.ts).
export const AUTO_MODEL_KEY = "auto";

export const CLIENT_MODEL_KEYS = {
  "gpt-6.1-sol": "openai/gpt-6.1-sol",
  "glm-5.3-flash": "zai/glm-5.3-flash",
  "muse-spark-open": "meta/muse-spark-open",
  "grok-4.7": "spacexai/grok-4.7",
  "gpt-6-astra": "openai/gpt-6-astra",
  "gemini-4-argon": "google/gemini-4-argon",
  "muse-wonder-1.0": "meta/muse-wonder-1.0",
} as const;

export type ClientModelKey = keyof typeof CLIENT_MODEL_KEYS;

export const MODEL_SELECTION_MARKER = "eveModelSelection";

// Image generation models for generate_image. Separate allowlist from chat
// models so a client cannot select an image id as the reply model (or the
// reverse). Only models expected to honor the US / ZDR / no-training gateway
// policy belong here; generate_image fails closed when no compliant provider
// is available for the chosen id.
export const DEFAULT_IMAGE_MODEL = "openai/gpt-image-1";

export const CLIENT_IMAGE_MODEL_KEYS = {
  "gpt-image-1": "openai/gpt-image-1",
  "imagen-4": "google/imagen-4.0-generate-001",
  "grok-imagine": "xai/grok-imagine-image",
} as const;

export type ClientImageModelKey = keyof typeof CLIENT_IMAGE_MODEL_KEYS;

export const IMAGE_MODEL_SELECTION_MARKER = "eveImageModelSelection";

// Vector (text-to-SVG) models for generate_svg. Separate allowlist from chat
// and raster image models. Arrow runs as gateway chat models without the US /
// ZDR / no-training filters — Quiver is not a ZDR provider — so these ids must
// never be selectable as the reply model.
export const DEFAULT_VECTOR_MODEL = "quiverai/arrow-2";

export const CLIENT_VECTOR_MODEL_KEYS = {
  "arrow-2": "quiverai/arrow-2",
  "arrow-2-telos": "quiverai/arrow-2-telos",
} as const;

export type ClientVectorModelKey = keyof typeof CLIENT_VECTOR_MODEL_KEYS;

export const VECTOR_MODEL_SELECTION_MARKER = "eveVectorModelSelection";

interface ScannedMessage {
  role: string;
  content: unknown;
  kind?: unknown;
}

export type ScannedMessageLike = readonly ScannedMessage[];

function messageText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      parts.push(part);
      continue;
    }
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      parts.push(part.text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function isClientContextMessage(message: ScannedMessage): boolean {
  if (message.role !== "user") return false;
  if (message.kind === "context.instruction") return true;
  if (message.kind !== undefined) return false;
  const text = messageText(message.content);
  return text?.startsWith("Client context:") === true;
}

function readAllowlistedMarker(
  messages: readonly ScannedMessage[],
  marker: string,
  allowlist: Record<string, string>,
): string | undefined {
  const markerPattern = new RegExp(`"${marker}"\\s*:\\s*"([^"]+)"`);
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!isClientContextMessage(message)) continue;
    const text = messageText(message.content);
    if (!text) continue;
    const match = text.match(markerPattern);
    if (!match) continue;
    const key = match[1];
    if (key in allowlist) return allowlist[key];
  }
  return undefined;
}

// Scan a turn's messages (newest first) for the clientContext marker and
// return the gateway model id it selects, or undefined when absent or unknown.
//
// eve serializes a JSON-object clientContext into an ephemeral framework user
// message of kind "context.instruction", rendered as:
//
//   Client context:
//   {"eveModelSelection":"gpt-6.1-sol"}
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
    if (!isClientContextMessage(message)) continue;
    const text = messageText(message.content);
    if (!text) continue;
    const match = text.match(markerPattern);
    if (!match) continue;
    const key = match[1];
    // Auto is the default route — treat it like a missing marker.
    if (key === AUTO_MODEL_KEY) return undefined;
    if (key in CLIENT_MODEL_KEYS) {
      return CLIENT_MODEL_KEYS[key as ClientModelKey];
    }
  }
  return undefined;
}

/** Gateway image-model id from clientContext, or undefined when absent/unknown. */
export function readClientImageModelSelection(
  messages: readonly ScannedMessage[],
): string | undefined {
  return readAllowlistedMarker(
    messages,
    IMAGE_MODEL_SELECTION_MARKER,
    CLIENT_IMAGE_MODEL_KEYS,
  );
}

/** Resolve the image model for generate_image (allowlist → default). */
export function resolveImageModelForTurn(
  messages: readonly ScannedMessage[],
): string {
  return readClientImageModelSelection(messages) ?? DEFAULT_IMAGE_MODEL;
}

/** Gateway vector-model id from clientContext, or undefined when absent/unknown. */
export function readClientVectorModelSelection(
  messages: readonly ScannedMessage[],
): string | undefined {
  return readAllowlistedMarker(
    messages,
    VECTOR_MODEL_SELECTION_MARKER,
    CLIENT_VECTOR_MODEL_KEYS,
  );
}

/** Resolve the vector model for generate_svg (allowlist → default). */
export function resolveVectorModelForTurn(
  messages: readonly ScannedMessage[],
): string {
  return readClientVectorModelSelection(messages) ?? DEFAULT_VECTOR_MODEL;
}
