import { recordUsage, sandboxCostCents } from "@/lib/billing/ledger";

type OpenEntry = {
  readonly userId: string;
  readonly openedAt: number;
  readonly vcpus: number;
  readonly label: string;
};

const openByKey = new Map<string, OpenEntry>();

function keyFor(sandboxId: string): string {
  return sandboxId;
}

/**
 * Call when a billable sandbox becomes active. Idempotent per sandboxId.
 */
export function noteSandboxOpened(input: {
  readonly sandboxId: string;
  readonly userId: string;
  readonly vcpus?: number;
  readonly label?: string;
}): void {
  if (!input.sandboxId || !input.userId) {
    return;
  }
  const key = keyFor(input.sandboxId);
  if (openByKey.has(key)) {
    return;
  }
  openByKey.set(key, {
    userId: input.userId,
    openedAt: Date.now(),
    vcpus: input.vcpus ?? 2,
    label: input.label ?? "sandbox",
  });
}

/**
 * Call when a sandbox stops. Records duration-based cost once.
 */
export async function noteSandboxStopped(input: {
  readonly sandboxId: string;
}): Promise<void> {
  const key = keyFor(input.sandboxId);
  const entry = openByKey.get(key);
  if (!entry) {
    return;
  }
  openByKey.delete(key);

  const durationMs = Math.max(0, Date.now() - entry.openedAt);
  const costCents = sandboxCostCents({
    vcpus: entry.vcpus,
    durationMs,
  });

  if (costCents <= 0) {
    return;
  }

  try {
    await recordUsage({
      idempotencyKey: `sandbox:${input.sandboxId}:stop:${entry.openedAt}`,
      userId: entry.userId,
      source: "sandbox",
      costCents,
      metadata: {
        sandboxId: input.sandboxId,
        vcpus: entry.vcpus,
        durationMs,
        label: entry.label,
      },
    });
  } catch (error) {
    console.error("[billing/sandbox-meter] record", error);
  }
}
