import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { APPLE_USAGE_PACKS } from "@/src/iap-products";

/**
 * DEV-only ASC IAP review screenshots. Open via
 * `exp://127.0.0.1:8081/--/asc-iap` — no auth required.
 * Mirrors Profile → Billing Subscribe + usage credit CTAs.
 */
export default function AscIapPreviewScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 24) + 24 },
      ]}
    >
      <Text variant="title">Subscribe to Pearl</Text>
      <Text variant="body" tone="muted" style={styles.body}>
        $29.99 per month via the App Store includes $10 of usage. Buy credit
        packs when you need more, or enable automatic billing on the web.
      </Text>
      <Button label="Subscribe" onPress={() => {}} />
      <Button
        label="Restore purchases"
        variant="secondary"
        onPress={() => {}}
      />

      <View style={styles.divider} />

      <Text variant="title">Usage credits</Text>
      <Text variant="body" tone="muted" style={styles.body}>
        Buy App Store credit packs when you hit the included allowance. For
        automatic usage billing, set it up at pearl.diy/billing on the web.
      </Text>
      {APPLE_USAGE_PACKS.map((pack) => (
        <Button key={pack.productId} label={pack.label} onPress={() => {}} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  body: { lineHeight: 22 },
  divider: { height: 24 },
});
