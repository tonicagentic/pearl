import { useLocalSearchParams, router, Stack } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/src/auth";

/**
 * In-app password reset when opened with ?token= (deep link or manual).
 * Email reset links still land on the web /reset-password page by default.
 */
export default function ResetPasswordRoute() {
  const params = useLocalSearchParams<{
    token?: string | string[];
    error?: string | string[];
  }>();
  const tokenParam = params.token;
  const errorParam = params.error;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  const linkError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  const { resetPassword, signInState, signInError } = useAuth();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const busy = signInState === "signing-in";
  const error = localError ?? signInError;

  const submit = () => {
    setLocalError(null);
    if (!token) {
      setLocalError("Missing reset token.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords don’t match.");
      return;
    }
    void resetPassword(token, password)
      .then(() => {
        setDone(true);
      })
      .catch(() => {
        // signInError already set by auth context
      });
  };

  if (linkError === "INVALID_TOKEN" || (!token && !done)) {
    return (
      <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
        <Stack.Screen options={{ title: "Reset password", headerShown: true }} />
        <View style={styles.center}>
          <Text variant="display" className="text-center tracking-tight">
            Link expired
          </Text>
          <Text variant="body" tone="muted" className="mb-1 text-center leading-[22px]">
            This password reset link is invalid or has expired. Request a new
            one from sign in.
          </Text>
          <Button
            label="Back to sign in"
            onPress={() => router.replace("/sign-in")}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
        <Stack.Screen options={{ title: "Reset password", headerShown: true }} />
        <View style={styles.center}>
          <Text variant="display" className="text-center tracking-tight">
            Password updated
          </Text>
          <Text variant="body" tone="muted" className="mb-1 text-center leading-[22px]">
            Sign in with your new password.
          </Text>
          <Button
            label="Sign in"
            onPress={() => router.replace("/sign-in")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      <Stack.Screen options={{ title: "Reset password", headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.center}>
          <Text variant="display" className="text-center tracking-tight">
            Choose a new password
          </Text>
          <Text variant="body" tone="muted" className="mb-1 text-center leading-[22px]">
            Use at least 8 characters.
          </Text>
          <View style={styles.fields}>
            <TextField
              accessibilityLabel="New password"
              autoComplete="new-password"
              editable={!busy}
              onChangeText={setPassword}
              placeholder="New password"
              secureTextEntry
              textContentType="newPassword"
              value={password}
            />
            <TextField
              accessibilityLabel="Confirm new password"
              autoComplete="new-password"
              editable={!busy}
              onChangeText={setConfirmPassword}
              onSubmitEditing={submit}
              placeholder="Confirm password"
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
            />
          </View>
          <Button
            disabled={password.length === 0 || confirmPassword.length === 0}
            label="Update password"
            loading={busy}
            loadingLabel="Saving…"
            onPress={submit}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              variant="secondary"
              tone="destructive"
              className="text-center"
            >
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            className="min-h-11 items-center justify-center"
            disabled={busy}
            onPress={() => router.replace("/sign-in")}
          >
            <Text variant="secondary">Back to sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  fields: { gap: 12 },
});
