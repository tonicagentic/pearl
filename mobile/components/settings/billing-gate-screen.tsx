import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  fetchBillingStatus,
  startBillingCheckout,
  type MobileBillingStatus,
} from "@/src/billing-client";
import { purchaseAppleSubscription, restoreApplePurchases } from "@/src/iap";
import { openWebUrlExternally } from "@/src/open-web-url";

/**
 * Subscribe / trial-ended empty state for the chats surface. Keeps Profile and
 * other home tabs reachable — it is not a full-app lock screen.
 */
export function BillingGateScreen({
  onReady,
}: {
  readonly onReady: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<MobileBillingStatus | null>(null);

  const checkStatus = useCallback(async () => {
    const next = await fetchBillingStatus();
    setStatus(next);
    if (!next || !next.enabled || next.exempt || next.allowed) {
      onReady();
      return true;
    }
    return false;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (await checkStatus()) {
          return;
        }
      } catch {
        if (!cancelled) {
          setError("Could not check billing status.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkStatus]);

  useEffect(() => {
    if (!polling) {
      return;
    }
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          if (cancelled) return;
          if (await checkStatus()) {
            setPolling(false);
          }
        } catch {
          // keep polling
        }
      })();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [checkStatus, polling]);

  const trialEnded =
    status?.reason === "trial_cap_reached" ||
    (status?.trial === true && status.allowed === false);

  const capReached = status?.reason === "cap_reached";

  const subscribe = async () => {
    setPending(true);
    setError(null);
    try {
      if (Platform.OS === "ios") {
        await purchaseAppleSubscription();
        if (await checkStatus()) {
          return;
        }
        setPolling(true);
      } else {
        const url = await startBillingCheckout();
        openWebUrlExternally(url);
        setPolling(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    setError(null);
    try {
      await restoreApplePurchases();
      await checkStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      {trialEnded ? (
        <>
          <Text variant="title">Monthly allowance used</Text>
          <Text variant="body" tone="muted" className="leading-[22px]">
            {status?.message ??
              "You used the included $20 of usage for this month. Access opens again next month."}
          </Text>
          {Platform.OS === "ios" ? (
            <Button
              label="Subscribe"
              loading={pending}
              loadingLabel="Purchasing…"
              onPress={() => void subscribe()}
            />
          ) : (
            <Button
              label="Continue to Stripe"
              loading={pending}
              loadingLabel="Opening Stripe…"
              onPress={() => void subscribe()}
            />
          )}
        </>
      ) : capReached && status?.paymentProvider === "apple" ? (
        <>
          <Text variant="title">Usage allowance used</Text>
          <Text variant="body" tone="muted" className="leading-[22px]">
            Buy usage credits in Profile → Billing, or enable automatic usage
            billing at pearl.diy/billing on the web.
          </Text>
        </>
      ) : (
        <>
          <Text variant="title">Subscribe to Pearl</Text>
          <Text variant="body" tone="muted" className="leading-[22px]">
            {Platform.OS === "ios"
              ? "$10 per month via the App Store, plus optional usage credits. New accounts start with a $50 included allowance."
              : "$10 per month, plus usage. New accounts start with a $50 usage cap you can raise in Settings."}
          </Text>
          <Button
            label={Platform.OS === "ios" ? "Subscribe" : "Continue to Stripe"}
            loading={pending}
            loadingLabel={
              Platform.OS === "ios" ? "Purchasing…" : "Opening Stripe…"
            }
            onPress={() => void subscribe()}
          />
          {Platform.OS === "ios" ? (
            <Button
              label="Restore purchases"
              variant="secondary"
              loading={restoring}
              loadingLabel="Restoring…"
              onPress={() => void restore()}
            />
          ) : null}
          {polling ? (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text variant="secondary">
                {Platform.OS === "ios"
                  ? "Confirming purchase…"
                  : "Waiting for payment to confirm…"}
              </Text>
            </View>
          ) : null}
        </>
      )}
      {error ? (
        <Text variant="secondary" tone="destructive" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
