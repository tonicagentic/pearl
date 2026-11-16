import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Body, Button, Caption, Card, Screen, Title } from "@/components/ui";
import { authClient, useSession } from "@/lib/auth";
import { PEARL_URL } from "@/lib/config";

export default function YouScreen() {
  const router = useRouter();
  const { data, refetch } = useSession();
  const [busy, setBusy] = useState(false);

  const signOut = () => {
    if (busy) return;
    setBusy(true);
    void authClient
      .signOut()
      .then(async () => {
        await refetch();
        router.replace("/sign-in");
      })
      .finally(() => setBusy(false));
  };

  return (
    <Screen>
      <View style={{ padding: 20, gap: 16 }}>
        <Title>You</Title>
        <Card>
          <View style={{ padding: 16, gap: 6 }}>
            <Body>{data?.user.name?.trim() || "Pearl user"}</Body>
            <Caption>{data?.user.email}</Caption>
          </View>
        </Card>
        <Caption>Signed in through {PEARL_URL}. Same account as Pearl.</Caption>
        <Button
          label={busy ? "Signing out…" : "Sign out"}
          variant="secondary"
          onPress={signOut}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}
