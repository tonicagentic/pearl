import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
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
import {
  purchaseAppleSubscription,
  purchaseAppleUsagePack,
  restoreApplePurchases,
} from "@/src/iap";
import {
  APPLE_SUBSCRIPTIONS_MANAGE_URL,
  APPLE_USAGE_PACKS,
} from "@/src/iap-products";
import { openWebUrlExternally } from "@/src/open-web-url";
import { formatSpendCents } from "@/src/usage-client";

const SOURCE_LABELS: Record<string, string> = {
  model: "Models",
  web_search: "Exa Search",
  exa_agent: "Exa research",
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
  if (status.paymentProvider === "apple") return "Subscribed (Apple)";
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
    return `Friend beta — $20/mo included allowance (not billed). Upgrade to Pearl Monthly for more.${resetSentence}`;
  }
  if (status.paymentProvider === "apple") {
    return status.hasExtendedUsageBilling
      ? `Apple subscription ($29.99/mo) plus automatic usage billing.${resetSentence}`
      : `Apple subscription is $29.99/mo with $10 included. Buy packs or enable auto-billing for more.${resetSentence}`;
  }
  return `Subscription is $29.99/mo with $10 included; overage up to your spend cap.${resetSentence}`;
}

/**
 * Profile → Billing. Plan, this period's spend, the usage cap, and the
 * payment method. iOS uses StoreKit; Stripe checkout stays on Android/web.
 */
export function BillingScreen() {
  const [status, setStatus] = useState<MobileBillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, setPending] = useState<
    "cap" | "checkout" | "portal" | "restore" | "pack" | null
  >(null);
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
    setHint(null);
    try {
      if (Platform.OS === "ios") {
        await purchaseAppleSubscription();
        await refresh();
        setHint("Subscription active.");
      } else {
        openWebUrlExternally(await startBillingCheckout());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
    } finally {
      setPending(null);
    }
  }, [pending, refresh]);

  const restore = useCallback(async () => {
    if (pending || Platform.OS !== "ios") return;
    setPending("restore");
    setError(null);
    setHint(null);
    try {
      const count = await restoreApplePurchases();
      await refresh();
      setHint(count > 0 ? "Purchases restored." : "No active Apple subscription found.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not restore purchases.",
      );
    } finally {
      setPending(null);
    }
  }, [pending, refresh]);

  const buyPack = useCallback(
    async (productId: string) => {
      if (pending || Platform.OS !== "ios") return;
      setPending("pack");
      setError(null);
      setHint(null);
      try {
        await purchaseAppleUsagePack(productId);
        await refresh();
        setHint("Usage credits added.");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not buy usage credits.",
        );
      } finally {
        setPending(null);
      }
    },
    [pending, refresh],
  );

  const managePayment = useCallback(async () => {
    if (pending) return;
    setPending("portal");
    setError(null);
    try {
      if (status?.paymentProvider === "apple") {
        await Linking.openURL(APPLE_SUBSCRIPTIONS_MANAGE_URL);
      } else {
        openWebUrlExternally(await startBillingPortal());
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open billing portal.",
      );
    } finally {
      setPending(null);
    }
  }, [pending, status?.paymentProvider]);

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
    status.canManageCap === true ||
    (status.canManageCap !== false &&
      status.enabled &&
      !status.exempt &&
      !status.trial &&
      !status.needsCheckout &&
      Boolean(status.hasExtendedUsageBilling) &&
      status.paymentProvider !== "apple");

  const showApplePacks =
    Platform.OS === "ios" &&
    status.enabled &&
    !status.exempt &&
    (status.hasAppleSubscription || status.paymentProvider === "apple") &&
    !status.needsCheckout;

  const showSubscribe =
    status.enabled &&
    !status.exempt &&
    (status.needsCheckout || status.trial);

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
        {status.prepaidCreditCents != null && status.prepaidCreditCents > 0 ? (
          <SettingsLabeledValue
            label="Prepaid credits"
            value={formatSpendCents(status.prepaidCreditCents)}
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

      {status.trial ? (
        <SettingsSection
          title="Plans"
          footer={
            <SettingsFormText tone="secondary">
              Friend trial: $20/mo soft cap, not billed. Pearl Monthly: $29.99
              with $10 included — then prepaid packs (iOS) or a card with a
              $100 default spend cap.
            </SettingsFormText>
          }
        >
          <SettingsLabeledValue label="Current" value="Friend trial" />
          <SettingsLabeledValue label="Upgrade" value="Pearl Monthly · $29.99" />
        </SettingsSection>
      ) : null}

      {showSubscribe ? (
        <SettingsSection
          footer={
            <SettingsFormText tone="secondary">
              {Platform.OS === "ios"
                ? "$29.99/mo via the App Store includes $10 of usage. Buy credit packs when you need more, or enable automatic billing on the web."
                : "$29.99/mo includes $10 of usage. Overage bills to your card up to a $100 spend cap you can raise in Settings."}
            </SettingsFormText>
          }
        >
          <SettingsButton
            disabled={pending !== null}
            label={
              pending === "checkout"
                ? Platform.OS === "ios"
                  ? "Purchasing…"
                  : "Opening Stripe…"
                : status.trial
                  ? Platform.OS === "ios"
                    ? "Upgrade"
                    : "Upgrade with Stripe"
                  : Platform.OS === "ios"
                    ? "Subscribe"
                    : "Continue to Stripe"
            }
            onPress={() => void subscribe()}
          />
          {Platform.OS === "ios" ? (
            <SettingsButton
              disabled={pending !== null}
              label={pending === "restore" ? "Restoring…" : "Restore purchases"}
              onPress={() => void restore()}
            />
          ) : null}
        </SettingsSection>
      ) : null}

      {showApplePacks ? (
        <SettingsSection
          title="Usage credits"
          footer={
            <SettingsFormText tone="secondary">
              Buy App Store credit packs when you hit the included allowance. For
              automatic usage billing, set it up at pearl.diy/billing on the web.
            </SettingsFormText>
          }
        >
          {APPLE_USAGE_PACKS.map((pack) => (
            <SettingsButton
              key={pack.productId}
              disabled={pending !== null}
              label={
                pending === "pack" ? "Purchasing…" : pack.label
              }
              onPress={() => void buyPack(pack.productId)}
            />
          ))}
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
            placeholder="100.00"
            value={capDollars}
          />
          <SettingsButton
            disabled={pending !== null}
            label={pending === "cap" ? "Saving…" : "Save cap"}
            onPress={() => void saveCap()}
          />
        </SettingsSection>
      ) : null}

      {status.hasPortal || status.paymentProvider === "apple" ? (
        <SettingsSection>
          <SettingsButton
            disabled={pending !== null}
            label={
              pending === "portal"
                ? "Opening…"
                : status.paymentProvider === "apple"
                  ? "Manage subscription"
                  : "Manage payment method"
            }
            onPress={() => void managePayment()}
          />
          {Platform.OS === "ios" && status.paymentProvider === "apple" ? (
            <SettingsButton
              disabled={pending !== null}
              label={pending === "restore" ? "Restoring…" : "Restore purchases"}
              onPress={() => void restore()}
            />
          ) : null}
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
