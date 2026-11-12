import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import {
  fetchBillingStatus,
  type MobileBillingStatus,
} from "@/src/billing-client";

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Compact billing summary for the mobile Settings sheet. */
export function BillingSettingsSection() {
  const [status, setStatus] = useState<MobileBillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchBillingStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View className="items-center py-3">
        <ActivityIndicator />
      </View>
    );
  }

  if (!status || !status.enabled) {
    return null;
  }

  return (
    <View className="gap-1 px-4 py-3">
      {status.exempt ? (
        <Text className="text-[13px] text-muted-foreground">
          Free pass — this account is not billed. Spent this period:{" "}
          {formatCents(status.spentCents)}.
        </Text>
      ) : (
        <Text className="text-[13px] text-muted-foreground">
          Spent {formatCents(status.spentCents)} of{" "}
          {formatCents(status.usageCapCents)} cap
          {status.remainingCents != null
            ? ` (${formatCents(status.remainingCents)} left)`
            : ""}
          .
        </Text>
      )}
      {status.bySource.map((row) => (
        <Text
          className="text-[12px] text-muted-foreground"
          key={row.source}
        >
          {row.source}: {formatCents(row.costCents)}
        </Text>
      ))}
    </View>
  );
}
