/** durable-harness WebSocket relay — must stay exposed when adding preview ports. */
export const SANDBOX_RELAY_PORT = 2010;

export const DEFAULT_PREVIEW_PORT = 3000;

/**
 * Full desired port list for a mini-app sandbox preview.
 * Always keeps the harness relay port so fx does not lose its channel.
 */
export function mergePreviewPorts(previewPort: number = DEFAULT_PREVIEW_PORT): number[] {
  const port =
    Number.isFinite(previewPort) && previewPort > 0
      ? Math.trunc(previewPort)
      : DEFAULT_PREVIEW_PORT;
  return [...new Set([SANDBOX_RELAY_PORT, port])].sort((a, b) => a - b);
}
