import { Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { CircleDollarSignIcon } from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";

const PEARL_MONEY_URL = "pearlmoney://";

/**
 * Profile → Money. A short ad for the Pearl Money companion app.
 * Figures in the card are a product preview, not this account's books.
 */
export function MoneyScreen() {
  return (
    <SheetScaffold
      footer={
        <View className="gap-2 pt-1">
          <Button label="Open Pearl Money" onPress={() => void openPearlMoney()} />
          <Text variant="caption" className="text-center">
            Same account as Pearl on this phone.
          </Text>
        </View>
      }
    >
      <View className="items-center gap-3 px-2 pt-6">
        <View className="size-[76px] items-center justify-center rounded-[22px] bg-emerald-500/15">
          <Icon
            as={CircleDollarSignIcon}
            className="size-9 text-emerald-600"
          />
        </View>
        <Text variant="caption" weight="medium">
          Pearl Money
        </Text>
        <Text variant="display" className="text-center tracking-tight">
          Your money, in one place.
        </Text>
        <Text variant="body" tone="muted" className="text-center leading-[23px]">
          The companion app for what you made, what you spent, and what you
          have. Net worth sits under the month. Upcoming bills show before
          they land.
        </Text>
      </View>

      <PreviewCard />
    </SheetScaffold>
  );
}

function PreviewCard() {
  return (
    <View className="gap-1.5">
      <Text variant="secondary" weight="medium" className="px-1">
        Preview
      </Text>
      <SettingsCard>
        <View className="gap-4 px-4 py-4">
          <Text variant="secondary" weight="medium">
            This month
          </Text>
          <View className="flex-row">
            <Stat label="Made" value="$8,420" valueClassName="text-emerald-600" />
            <Stat label="Spent" value="$3,150" valueClassName="text-rose-600" />
            <Stat label="Net" value="$5,270" />
          </View>
          <View className="h-px bg-border" />
          <View className="gap-0.5">
            <Text variant="secondary">Net worth</Text>
            <Text variant="title">$186,400</Text>
          </View>
          <View className="h-px bg-border" />
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 gap-0.5">
              <Text variant="label" numberOfLines={1}>
                Rent
              </Text>
              <Text variant="secondary">Upcoming</Text>
            </View>
            <Text variant="body" tone="muted">
              Dec 1
            </Text>
          </View>
        </View>
      </SettingsCard>
      <Text variant="caption" className="px-1">
        Sample of the Pearl Money home screen.
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  readonly label: string;
  readonly value: string;
  readonly valueClassName?: string;
}) {
  return (
    <View className="min-w-0 flex-1 gap-0.5">
      <Text variant="secondary">{label}</Text>
      <Text variant="label" weight="semibold" className={valueClassName}>
        {value}
      </Text>
    </View>
  );
}

async function openPearlMoney() {
  try {
    await Linking.openURL(PEARL_MONEY_URL);
  } catch {
    Alert.alert(
      "Pearl Money",
      "Pearl Money isn't installed on this phone.",
    );
  }
}
