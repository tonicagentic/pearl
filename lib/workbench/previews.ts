import type { WorkbenchPreview } from "./types.ts";

const VERCEL_RUN_HOST = /\.vercel\.run$/i;

export type DevServerPublishInput = {
  readonly repoFullName: string;
  readonly script: string;
  readonly port: number;
  /** Hostname returned by the sandbox domain() call, e.g. xxx.vercel.run */
  readonly hostname: string;
};

export function resolveDevScript(packageJson: {
  readonly scripts?: Record<string, string> | null;
}): { readonly script: string; readonly port: number } {
  const scripts = packageJson.scripts ?? {};
  if (typeof scripts.dev === "string" && scripts.dev.trim()) {
    return {
      script: "dev",
      port: guessPort(scripts.dev, 3000),
    };
  }
  if (typeof scripts.start === "string" && scripts.start.trim()) {
    return {
      script: "start",
      port: guessPort(scripts.start, 3000),
    };
  }
  return { script: "dev", port: 3000 };
}

function guessPort(command: string, fallback: number): number {
  const match =
    command.match(/--port[=\s]+(\d{2,5})/) ??
    command.match(/-p[=\s]+(\d{2,5})/) ??
    command.match(/PORT=(\d{2,5})/);
  if (!match) return fallback;
  const port = Number.parseInt(match[1]!, 10);
  return Number.isFinite(port) && port > 0 && port < 65536 ? port : fallback;
}

export function buildDevServerPreview(
  input: DevServerPublishInput,
): WorkbenchPreview {
  const host = input.hostname.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!VERCEL_RUN_HOST.test(host) && !host.endsWith(".vercel.run")) {
    // Still allow; sandbox may return a subdomain we have not seen.
  }
  const url = `https://${host}`;
  return {
    kind: "dev-server",
    url,
    label: `${input.repoFullName} · ${input.script} :${input.port}`,
    repoFullName: input.repoFullName,
  };
}

export function buildExpoSimulatorPreview(args: {
  readonly repoFullName: string;
  readonly previewUrl: string;
}): WorkbenchPreview {
  return {
    kind: "expo-simulator",
    url: args.previewUrl,
    label: `${args.repoFullName} · Expo Simulator`,
    repoFullName: args.repoFullName,
  };
}

export function mergeComputerPreviews(
  existing: readonly WorkbenchPreview[],
  next: WorkbenchPreview,
): readonly WorkbenchPreview[] {
  const withoutSameKind = existing.filter(
    (p) => !(p.kind === next.kind && p.repoFullName === next.repoFullName),
  );
  return [...withoutSameKind, next];
}
