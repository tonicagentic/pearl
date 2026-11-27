import { View } from "react-native";
import { useRouter } from "expo-router";
import { CircleDollarSignIcon } from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/**
 * Profile → Money. Opens in-app Finances (spend, connections, reconcile).
 */
export function MoneyScreen() {
  const router = useRouter();

  return (
    <SheetScaffold
      footer={
        <View className="gap-2 pt-1">
          <Button
            label="Open Finances"
            onPress={() => {
              router.dismiss();
              router.navigate("/finances");
            }}
          />
          <Text variant="caption" className="text-center">
            Spend, banks, chart of accounts, and reconcile.
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
          Finances
        </Text>
        <Text variant="display" className="text-center tracking-tight">
          Your books, in Pearl.
        </Text>
        <Text variant="body" tone="muted" className="text-center leading-[23px]">
          Link banks, manage categories, review spend, and reconcile
          transactions without leaving the app.
        </Text>
      </View>
    </SheetScaffold>
  );
}
