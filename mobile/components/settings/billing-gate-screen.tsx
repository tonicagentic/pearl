import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  fetchBillingStatus,
  startBillingCheckout,
  type MobileBillingStatus,
} from "@/src/billing-client";
import { openWebUrlExternally } from "@/src/open-web-url";

/**
 * Shown after sign-in when the account cannot chat yet: Stripe checkout for
 * paying users, or a trial-ended message for allowlisted friend-beta accounts.
 */
export function BillingGateScreen({
  onReady,
}: {
  readonly onReady: () => void;
}) {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const [pending, setPending] = useState(false);
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

  const subscribe = async () => {
    setPending(true);
    setError(null);
    try {
      const url = await startBillingCheckout();
      openWebUrlExternally(url);
      setPolling(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      <View style={styles.container}>
        {trialEnded ? (
          <>
            <Text variant="title">Monthly allowance used</Text>
            <Text variant="body" tone="muted" className="leading-[22px]">
              {status?.message ??
                "You used the included $20 of usage for this month. Access opens again next month."}
            </Text>
          </>
        ) : (
          <>
            <Text variant="title">Subscribe to Pearl</Text>
            <Text variant="body" tone="muted" className="leading-[22px]">
              $10 per month, plus usage. New accounts start with a $50 usage
              cap you can raise in Settings.
            </Text>
            <Button
              label="Continue to Stripe"
              loading={pending}
              loadingLabel="Opening Stripe…"
              onPress={() => void subscribe()}
            />
            {polling ? (
              <View style={styles.row}>
                <ActivityIndicator />
                <Text variant="secondary">Waiting for payment to confirm…</Text>
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
    </SafeAreaView>
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
