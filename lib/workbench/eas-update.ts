import { PEARL_EXPO_PROJECT_ID } from "./types.ts";

export type EasUpdateRequest = {
  readonly expoProjectId: string;
  readonly channel: string;
  readonly workingDirectory: string | null;
  readonly message: string | null;
  readonly isPearl: boolean;
};

/**
 * Build an EAS Update request aimed at the pin's Expo project.
 * Pearl's project id is only used when the caller did not supply one AND
 * marked the task as Pearl.
 */
export function buildEasUpdateRequest(args: {
  readonly expoProjectId?: string | null;
  readonly channel?: string | null;
  readonly workingDirectory?: string | null;
  readonly message?: string | null;
  readonly fallbackToPearl?: boolean;
}): EasUpdateRequest {
  const explicit = args.expoProjectId?.trim() || null;
  const expoProjectId =
    explicit ||
    (args.fallbackToPearl ? PEARL_EXPO_PROJECT_ID : "");
  if (!expoProjectId) {
    throw new Error(
      "expoProjectId is required for EAS Update on a non-Pearl repo.",
    );
  }
  return {
    expoProjectId,
    channel: args.channel?.trim() || "preview",
    workingDirectory: args.workingDirectory?.trim() || null,
    message: args.message?.trim() || null,
    isPearl: expoProjectId === PEARL_EXPO_PROJECT_ID,
  };
}

/** CLI args for `eas update` (token supplied via env, never argv). */
export function easUpdateCliArgs(request: EasUpdateRequest): string[] {
  const args = [
    "update",
    "--channel",
    request.channel,
    "--non-interactive",
  ];
  if (request.message) {
    args.push("--message", request.message);
  }
  return args;
}
