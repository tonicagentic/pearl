import {
  DEFAULT_IMAGE_USD,
  EXA_SEARCH_AUTO_USD,
  formatSpendUsd,
} from "@/lib/billing/provider-pricing";

export type UsageSourceId =
  | "model"
  | "web_search"
  | "exa_agent"
  | "sandbox"
  | "image"
  | string;

export type UsageSourceMeta = {
  readonly id: UsageSourceId;
  readonly label: string;
  /** Short provider / product name shown under the source. */
  readonly provider: string;
  /**
   * Exact unit USD when pricing is flat. null when cost varies
   * (Exa Agent, model tokens, sandbox CPU).
   */
  readonly unitUsd: number | null;
  readonly pricingNote: string;
};

const SOURCE_META: Record<string, UsageSourceMeta> = {
  model: {
    id: "model",
    label: "Models",
    provider: "Chat / tool model calls",
    unitUsd: null,
    pricingNote: "Billed from reported token cost per call",
  },
  web_search: {
    id: "web_search",
    label: "Web search",
    provider: "Exa Search (AI Gateway)",
    unitUsd: EXA_SEARCH_AUTO_USD,
    pricingNote: `Exa auto · ${formatSpendUsd(EXA_SEARCH_AUTO_USD)} each (up to 10 results)`,
  },
  exa_agent: {
    id: "exa_agent",
    label: "Exa research",
    provider: "Exa Agent API",
    unitUsd: null,
    pricingNote: "Billed from Exa's costDollars.total (effort list price if omitted)",
  },
  sandbox: {
    id: "sandbox",
    label: "Sandboxes",
    provider: "Vercel Sandbox",
    unitUsd: null,
    pricingNote: "Billed from active CPU time",
  },
  image: {
    id: "image",
    label: "Images",
    provider: "Image generation",
    unitUsd: DEFAULT_IMAGE_USD,
    pricingNote: `AI Gateway list price per model (default ${formatSpendUsd(DEFAULT_IMAGE_USD)} / image)`,
  },
};

export function usageSourceMeta(source: string): UsageSourceMeta {
  return (
    SOURCE_META[source] ?? {
      id: source,
      label: source,
      provider: source,
      unitUsd: null,
      pricingNote: "Usage-based",
    }
  );
}

export function formatCents(cents: number): string {
  return formatSpendUsd(cents / 100);
}

/** e.g. "12 × $0.007" or "3 runs · avg $0.4833". */
export function formatEventRate(input: {
  readonly eventCount: number;
  readonly costUsd: number;
  readonly unitUsd: number | null;
  readonly unitNoun: string;
}): string {
  const { eventCount, costUsd, unitUsd, unitNoun } = input;
  if (eventCount <= 0) return "No events";
  if (unitUsd != null && unitUsd > 0) {
    const expected = eventCount * unitUsd;
    const allSame = Math.abs(costUsd - expected) < 1e-9;
    if (allSame) {
      return `${eventCount} × ${formatSpendUsd(unitUsd)}`;
    }
  }
  const avg = costUsd / eventCount;
  return `${eventCount} ${unitNoun} · avg ${formatSpendUsd(avg)}`;
}

export function unitNounForSource(source: string): string {
  switch (source) {
    case "web_search":
      return "searches";
    case "exa_agent":
      return "runs";
    case "image":
      return "images";
    case "sandbox":
      return "sessions";
    case "model":
      return "calls";
    default:
      return "events";
  }
}
