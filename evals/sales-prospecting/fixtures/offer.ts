// Shared phrases for the sales-prospecting suite. Distinctive enough that a
// research query copying them proves the agent used the user's answers.

export const MAINTENANCE_OFFER = {
  kind: "general offer",
  name: "maintenance monitoring",
  whatItDoes: "catches compressor failure before a shutdown",
  pain: "unplanned compressor downtime",
} as const;

export const REFRIGERATION_ICP = {
  industry: "industrial refrigeration",
  companySize: "80 to 200 employees",
  buyerRole: "VP of operations",
  problem: "unplanned compressor downtime",
} as const;

export const OFFER_RECORD_PROMPT = [
  `Offer`,
  `Kind: ${MAINTENANCE_OFFER.kind}`,
  `Name: ${MAINTENANCE_OFFER.name}`,
  `What it does: ${MAINTENANCE_OFFER.whatItDoes}`,
  `Pain: ${MAINTENANCE_OFFER.pain}`,
].join("\n");

export const ICP_RECORD_PROMPT = [
  `ICP`,
  `Industry: ${REFRIGERATION_ICP.industry}`,
  `Company size: ${REFRIGERATION_ICP.companySize}`,
  `Buyer role: ${REFRIGERATION_ICP.buyerRole}`,
  `Problem: ${REFRIGERATION_ICP.problem}`,
].join("\n");

export type ExaAgentRunInput = {
  query?: string | null;
  runId?: string | null;
  preset?: string | null;
  maxItems?: number | null;
  listItemFields?: Array<{ name?: string }> | null;
};

export function firstResearchCall(
  toolCalls: ReadonlyArray<{ name: string; input?: unknown }>,
): ExaAgentRunInput | undefined {
  for (const call of toolCalls) {
    if (call.name !== "exa_agent_run") continue;
    const input = call.input as ExaAgentRunInput | undefined;
    if (input?.runId && !input.query) continue;
    return input;
  }
  return undefined;
}

export function fieldNames(
  input: ExaAgentRunInput | undefined,
): string[] {
  if (!Array.isArray(input?.listItemFields)) return [];
  return input.listItemFields
    .map((field) =>
      typeof field?.name === "string" ? field.name.toLowerCase() : "",
    )
    .filter((name) => name.length > 0);
}

export function hasTriggerField(names: string[]): boolean {
  return names.some((name) =>
    /outreach_trigger|trigger|reason_to_reach_out/.test(name),
  );
}

export function hasIndustryAndBuyerFields(names: string[]): boolean {
  const hasIndustry = names.some((name) => /industry|segment|vertical/.test(name));
  const hasBuyer = names.some((name) =>
    /buyer|role|title|persona/.test(name),
  );
  return hasIndustry && hasBuyer;
}
