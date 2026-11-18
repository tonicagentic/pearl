import { generateText, Output, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

/** True when AI Gateway or Marketplace Exa credentials are available. */
export function exaConfigured() {
  return Boolean(
    process.env.EXA_API_KEY?.trim() ||
      process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

export function estimatesMissingConfigMessage() {
  return (
    "Estimates need Vercel AI Gateway (recommended) or an Exa Marketplace key. " +
    "Link this project (`vercel link`), enable AI Gateway, install Exa from the Marketplace if you want a dedicated key, then run `vercel env pull`."
  );
}

const vehicleEstimateSchema = z.object({
  estimatedMpg: z.number().positive().describe("Typical combined MPG for this vehicle"),
  gasPricePerGallon: z
    .number()
    .positive()
    .describe("Current regular gas price per gallon near the registration area"),
  estimatedValue: z
    .number()
    .positive()
    .describe("Estimated private-party or retail market value in USD"),
  valueSource: z
    .string()
    .describe("Short label for where the value came from, e.g. Kelley Blue Book"),
  // Keep required (empty string OK) — Gateway JSON schema needs every property required
  notes: z.string().describe("Optional short note; use empty string if none"),
});

const homeEstimateSchema = z.object({
  estimatedValue: z
    .number()
    .positive()
    .describe("Estimated current market value / Zestimate-style value in USD"),
  valueSource: z
    .string()
    .describe("Short label for the source, e.g. Zillow estimate"),
  notes: z.string().describe("Optional short note; use empty string if none"),
});

export type VehicleValueEstimate = {
  estimatedValue: number;
  valueSource: string;
};

export type VehicleFuelAndValueEstimate = VehicleValueEstimate & {
  estimatedMpg: number;
  gasPricePerGallon: number;
  fuelMonthly: number;
};

export type HomeValueEstimate = {
  estimatedValue: number;
  valueSource: string;
};

const vehicleValueOnlySchema = z.object({
  estimatedValue: z
    .number()
    .positive()
    .describe("Estimated private-party or retail market value in USD"),
  valueSource: z
    .string()
    .describe("Short label for where the value came from, e.g. Kelley Blue Book"),
  notes: z.string().describe("Optional short note; use empty string if none"),
});

async function withExaObject<T>({
  schema,
  prompt,
}: {
  schema: z.ZodType<T>;
  prompt: string;
}): Promise<T> {
  if (!exaConfigured()) {
    throw new Error(estimatesMissingConfigMessage());
  }

  const result = await generateText({
    model: gateway("openai/gpt-5-mini"),
    // AI SDK tool typing drifts across gateway versions; search still works at runtime.
    tools: {
      exa_search: gateway.tools.exaSearch({ numResults: 6 }),
    } as Parameters<typeof generateText>[0]["tools"],
    stopWhen: stepCountIs(6),
    output: Output.object({ schema }),
    prompt,
  });

  if (!result.output) {
    throw new Error("No structured estimate returned from Exa/AI Gateway");
  }
  return result.output as T;
}

export async function estimateVehicleValue(input: {
  year: number | null;
  make: string | null;
  model: string | null;
  city?: string | null;
  region?: string | null;
}): Promise<VehicleValueEstimate> {
  const ymm = [input.year, input.make, input.model].filter(Boolean).join(" ");
  if (!ymm) {
    throw new Error("Vehicle needs year, make, and model to estimate");
  }
  const place =
    [input.city, input.region].filter(Boolean).join(", ") || "United States";

  const parsed = await withExaObject({
    schema: vehicleValueOnlySchema,
    prompt: `Use web search to estimate the current used market value for a ${ymm} vehicle near ${place}.

Prefer private-party value, else retail, for average condition. Prefer recent reputable sources (KBB, Edmunds, CarGurus). Return only the structured fields.`,
  });

  return {
    estimatedValue: Math.round(parsed.estimatedValue),
    valueSource: parsed.valueSource,
  };
}

export async function estimateVehicleFuelAndValue(input: {
  year: number | null;
  make: string | null;
  model: string | null;
  milesPerMonth: number;
  city?: string | null;
  region?: string | null;
}): Promise<VehicleFuelAndValueEstimate> {
  const ymm = [input.year, input.make, input.model].filter(Boolean).join(" ");
  if (!ymm) {
    throw new Error("Vehicle needs year, make, and model to estimate");
  }
  const place = [input.city, input.region].filter(Boolean).join(", ") || "United States";

  const parsed = await withExaObject({
    schema: vehicleEstimateSchema,
    prompt: `Use web search to estimate facts for a ${ymm} vehicle registered near ${place}.

Find:
1) Typical combined MPG for a ${ymm}
2) Current regular unleaded gas price per gallon near ${place}
3) A current used market value (private-party preferred, else retail) for a ${ymm} in average condition in ${place}

Return only the structured fields. Prefer recent reputable sources (fuel economy sites, AAA/gas apps, KBB/Edmunds/CarGurus).`,
  });

  const fuelMonthly =
    (input.milesPerMonth / parsed.estimatedMpg) * parsed.gasPricePerGallon;

  return {
    estimatedMpg: parsed.estimatedMpg,
    gasPricePerGallon: parsed.gasPricePerGallon,
    fuelMonthly: Math.round(fuelMonthly * 100) / 100,
    estimatedValue: Math.round(parsed.estimatedValue),
    valueSource: parsed.valueSource,
  };
}

export async function estimateHomeValue(input: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}): Promise<HomeValueEstimate> {
  const street = [input.addressLine1, input.addressLine2]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  const locality = [input.city, input.region, input.postalCode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  const address = [street, locality].filter(Boolean).join(", ");
  if (!address) {
    throw new Error("Home needs an address to estimate value");
  }

  const parsed = await withExaObject({
    schema: homeEstimateSchema,
    prompt: `Use web search to find the current estimated market value for the home at ${address}.

Prefer Zillow Zestimate, Redfin estimate, or similar public home-value estimates. Return USD estimated value and a short source label.`,
  });

  return {
    estimatedValue: Math.round(parsed.estimatedValue),
    valueSource: parsed.valueSource,
  };
}
