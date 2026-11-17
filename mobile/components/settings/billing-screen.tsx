import { useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsSection,
} from "@/components/settings/native";
import {
  fetchBillingStatus,
  startBillingCheckout,
  startBillingPortal,
  updateUsageCap,
  type MobileBillingStatus,
} from "@/src/billing-client";
import { openWebUrlExternally } from "@/src/open-web-url";
import { formatSpendCents } from "@/src/usage-client";

const SOURCE_LABELS: Record<string, string> = {
  model: "Models",
  web_search: "Web search",
  exa_agent: "Research",
  sandbox: "Sandboxes",
  image: "Images",
};

const MAX_CAP_CENTS = 1_000_000_00;

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function planLabel(status: MobileBillingStatus): string {
  if (!status.enabled) return "Off";
  if (status.exempt) return "Free pass";
  if (status.trial) {
    return status.reason === "trial_cap_reached" ? "Allowance used" : "Friend beta";
  }
  if (status.needsCheckout) return "Not subscribed";
  if (status.reason === "payment_failed") return "Payment failed";
  if (status.reason === "cap_reached") return "Cap reached";
  return "Subscribed";
}

function formatReset(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function planSummary(status: MobileBillingStatus): string {
  if (!status.enabled) return "Billing is off on this host.";
  if (status.exempt) return "This account has a free pass and is not invoiced.";
  const reset = formatReset(status.periodEnd);
  const resetSentence = reset ? ` Resets ${reset}.` : "";
  if (status.trial) {
    return `Included monthly allowance. This account is not billed.${resetSentence}`;
  }
  return `Subscription is $10 a month, plus usage.${resetSentence}`;
}

/**
 * Profile → Billing. Plan, this period's spend, the usage cap, and the
 * payment method. Stripe checkout and the card portal open outside the app.
 */
export function BillingScreen() {
  const [status, setStatus] = useState<MobileBillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, setPending] = useState<"cap" | "checkout" | "portal" | null>(
    null,
  );
  const [capDollars, setCapDollars] = useState("");

  const refresh = useCallback(async () => {
    const next = await fetchBillingStatus();
    setStatus(next);
    if (!next) {
      setError("Could not load billing.");
      return;
    }
    setError(null);
    if (next.usageCapCents != null) {
      setCapDollars((next.usageCapCents / 100).toFixed(2));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void refresh()
        .catch((cause) => {
          if (cancelled) return;
          setStatus(null);
          setError(cause instanceof Error ? cause.message : "Could not load billing.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [refresh]),
  );

  const subscribe = useCallback(async () => {
    if (pending) return;
    setPending("checkout");
    setError(null);
    try {
      openWebUrlExternally(await startBillingCheckout());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
    } finally {
      setPending(null);
    }
  }, [pending]);

  const managePayment = useCallback(async () => {
    if (pending) return;
    setPending("portal");
    setError(null);
    try {
      openWebUrlExternally(await startBillingPortal());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open billing portal.",
      );
    } finally {
      setPending(null);
    }
  }, [pending]);

  const saveCap = useCallback(async () => {
    if (pending) return;
    setHint(null);
    setError(null);
    const dollars = Number(capDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a dollar amount.");
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents > MAX_CAP_CENTS) {
      setError("Cap must be $1,000,000 or less.");
      return;
    }
    setPending("cap");
    try {
      await updateUsageCap(cents);
      await refresh();
      setHint("Saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update spend cap.");
    } finally {
      setPending(null);
    }
  }, [capDollars, pending, refresh]);

  if (loading && !status) {
    return <ActivityIndicator accessibilityLabel="Loading billing" />;
  }

  if (!status) {
    return (
      <SettingsForm>
        <SettingsFormText tone="destructive">
          {error ?? "Could not load billing."}
        </SettingsFormText>
      </SettingsForm>
    );
  }

  const canManageCap =
    status.enabled && !status.exempt && !status.trial && !status.needsCheckout;

  return (
    <SettingsForm>
      <SettingsSection
        title="Plan"
        footer={
          <SettingsFormText tone="secondary">{planSummary(status)}</SettingsFormText>
        }
      >
        <SettingsLabeledValue label="Status" value={planLabel(status)} />
        <SettingsLabeledValue
          label="Spent"
          value={formatSpendCents(status.spentCents)}
        />
        {!status.exempt && status.usageCapCents != null ? (
          <SettingsLabeledValue
            label="Cap"
            value={formatSpendCents(status.usageCapCents)}
          />
        ) : null}
        {!status.exempt && status.remainingCents != null ? (
          <SettingsLabeledValue
            label="Remaining"
            value={formatSpendCents(status.remainingCents)}
          />
        ) : null}
      </SettingsSection>

      {status.bySource.length > 0 ? (
        <SettingsSection title="This period">
          {status.bySource.map((row) => (
            <SettingsLabeledValue
              key={row.source}
              label={sourceLabel(row.source)}
              value={formatSpendCents(row.costCents)}
            />
          ))}
        </SettingsSection>
      ) : null}

      {status.enabled && status.needsCheckout ? (
        <SettingsSection
          footer={
            <SettingsFormText tone="secondary">
              $10 a month, plus usage. New accounts start with a $50 usage cap.
            </SettingsFormText>
          }
        >
          <SettingsButton
            disabled={pending !== null}
            label={pending === "checkout" ? "Opening Stripe…" : "Continue to Stripe"}
            onPress={() => void subscribe()}
          />
        </SettingsSection>
      ) : null}

      {canManageCap ? (
        <SettingsSection
          title="Usage cap"
          footer={
            <SettingsFormText tone="secondary">
              Pearl stops when spend for this period reaches this amount.
            </SettingsFormText>
          }
        >
          <SettingsField
            label="Cap (USD)"
            onChangeText={(value) => {
              setCapDollars(value);
              setHint(null);
              setError(null);
            }}
            placeholder="50.00"
            value={capDollars}
          />
          <SettingsButton
            disabled={pending !== null}
            label={pending === "cap" ? "Saving…" : "Save cap"}
            onPress={() => void saveCap()}
          />
        </SettingsSection>
      ) : null}

      {status.hasPortal ? (
        <SettingsSection>
          <SettingsButton
            disabled={pending !== null}
            label={
              pending === "portal" ? "Opening…" : "Manage payment method"
            }
            onPress={() => void managePayment()}
          />
        </SettingsSection>
      ) : null}

      {status.message && !status.allowed && !status.exempt ? (
        <SettingsFormText tone="secondary">{status.message}</SettingsFormText>
      ) : null}
      {hint ? <SettingsFormText tone="secondary">{hint}</SettingsFormText> : null}
      {error ? (
        <SettingsFormText tone="destructive">{error}</SettingsFormText>
      ) : null}
    </SettingsForm>
  );
}
