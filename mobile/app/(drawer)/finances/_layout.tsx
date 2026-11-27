import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

export const unstable_settings = {
  anchor: "index",
};

export default function FinancesStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "Finances" }} />
        <Stack.Screen
          name="transactions"
          options={{ title: "Transactions" }}
        />
        <Stack.Screen name="reconcile" options={{ title: "Reconcile" }} />
        <Stack.Screen name="connections" options={{ title: "Connections" }} />
        <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
        <Stack.Screen name="tasks" options={{ title: "Tasks" }} />
      </Stack>
    </DrawerScene>
  );
}
