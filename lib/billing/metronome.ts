import {
  getMetronomeApiToken,
  getMetronomeRateCardId,
} from "@/lib/billing/config";

const METRONOME_BASE = "https://api.metronome.com";

type MetronomeCustomer = {
  readonly id: string;
};

/**
 * Create a Metronome customer linked to a Stripe customer id so usage
 * invoices land on the same Stripe Customer as the $10 subscription.
 */
export async function ensureMetronomeCustomer(input: {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly stripeCustomerId: string;
  readonly existingMetronomeCustomerId?: string | null;
}): Promise<string | null> {
  const token = getMetronomeApiToken();
  if (!token) {
    return null;
  }

  if (input.existingMetronomeCustomerId) {
    return input.existingMetronomeCustomerId;
  }

  const body: Record<string, unknown> = {
    name: input.name || input.email,
    ingest_aliases: [input.userId, input.email],
    customer_billing_provider_configurations: [
      {
        billing_provider: "stripe",
        configuration: {
          stripe_customer_id: input.stripeCustomerId,
        },
        delivery_method: "direct_to_provider",
      },
    ],
  };

  const response = await fetch(`${METRONOME_BASE}/v1/customers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      "[billing/metronome] create customer failed",
      response.status,
      detail.slice(0, 500),
    );
    return null;
  }

  const json = (await response.json()) as {
    data?: MetronomeCustomer;
  };
  const customerId = json.data?.id;
  if (!customerId) {
    return null;
  }

  const rateCardId = getMetronomeRateCardId();
  if (rateCardId) {
    await createPayAsYouGoContract({
      customerId,
      rateCardId,
      token,
    });
  }

  return customerId;
}

async function createPayAsYouGoContract(input: {
  readonly customerId: string;
  readonly rateCardId: string;
  readonly token: string;
}): Promise<void> {
  const startingAt = new Date().toISOString();
  const response = await fetch(`${METRONOME_BASE}/v1/contracts/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_id: input.customerId,
      rate_card_id: input.rateCardId,
      starting_at: startingAt,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      "[billing/metronome] create contract failed",
      response.status,
      detail.slice(0, 500),
    );
  }
}

export type MetronomeIngestEvent = {
  readonly transaction_id: string;
  readonly customer_id: string;
  readonly event_type: string;
  readonly timestamp: string;
  readonly properties: Record<string, unknown>;
};

/**
 * Batch ingest (1–100 events). transaction_id must equal the ledger
 * idempotency key so retries never double-count.
 */
export async function ingestUsageEvents(
  events: readonly MetronomeIngestEvent[],
): Promise<boolean> {
  const token = getMetronomeApiToken();
  if (!token || events.length === 0) {
    return false;
  }

  for (let offset = 0; offset < events.length; offset += 100) {
    const batch = events.slice(offset, offset + 100);
    const response = await fetch(`${METRONOME_BASE}/v1/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "[billing/metronome] ingest failed",
        response.status,
        detail.slice(0, 500),
      );
      return false;
    }
  }

  return true;
}
