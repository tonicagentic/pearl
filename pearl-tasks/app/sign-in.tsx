import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Body, Button, Caption, Field, Screen, Title } from "@/components/ui";
import { authClient, useSession } from "@/lib/auth";
import { PEARL_URL } from "@/lib/config";

export default function SignInScreen() {
  const router = useRouter();
  const { refetch } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    void authClient
      .signInEmail(email, password)
      .then(async () => {
        await refetch();
        router.replace("/(tabs)");
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Sign-in failed.");
        setBusy(false);
      });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 8, marginBottom: 12 }}>
            <Title>Pearl Tasks</Title>
            <Body muted>
              Same account as Pearl. Sign in once and your tasks and projects
              follow.
            </Body>
          </View>
          <Field
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            autoCapitalize="none"
            autoComplete="password"
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Caption>
              <Body muted>{error}</Body>
            </Caption>
          ) : null}
          <Button
            label={busy ? "Signing in…" : "Sign in"}
            onPress={submit}
            disabled={busy || !email.trim() || !password}
          />
          <Caption>Auth server: {PEARL_URL}</Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
