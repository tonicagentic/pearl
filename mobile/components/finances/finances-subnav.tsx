import { Pressable, ScrollView, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { Text } from "@/components/ui/text";

const ITEMS = [
  { href: "/finances", label: "Spend" },
  { href: "/finances/transactions", label: "Transactions" },
  { href: "/finances/reconcile", label: "Reconcile" },
  { href: "/finances/connections", label: "Connections" },
  { href: "/finances/accounts", label: "Accounts" },
  { href: "/finances/tasks", label: "Tasks" },
] as const;

export function FinancesSubnav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerClassName="flex-row gap-2"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/finances"
            ? pathname === "/finances" || pathname === "/finances/"
            : pathname?.startsWith(item.href);
        return (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            onPress={() => router.navigate(item.href)}
            className={
              active
                ? "rounded-full bg-secondary px-3 py-1.5"
                : "rounded-full border border-border px-3 py-1.5"
            }
          >
            <Text variant="caption" weight={active ? "medium" : "regular"}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <View className="w-1" />
    </ScrollView>
  );
}
