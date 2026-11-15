import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type TextInputInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import Animated, { LinearTransition } from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth, type AuthCtaFrame } from "@/src/auth";

type AuthMode = "sign-in" | "sign-up" | "forgot";

/** The sign-in / create-account gate: email/password through the agent's better-auth. */
export function SignInScreen({
  onCtaFrame,
  onBack,
  handOffActive = false,
}: {
  /** Latest measured CTA frame for the composer morph. */
  onCtaFrame?: (frame: AuthCtaFrame) => void;
  /** Return to the Pearl intro (signed-out start). */
  onBack?: () => void;
  /** Hide interactive chrome while the morph overlay owns the transition. */
  handOffActive?: boolean;
}) {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    signInState,
    signInError,
  } = useAuth();
  // SafeAreaView is a native codegen view — theme background via style, not className.
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const ctaFrameRef = useRef<AuthCtaFrame | null>(null);
  const emailRef = useRef<TextInputInstance>(null);

  const busy = signInState === "signing-in";
  const error = localError ?? signInError;
  const canSubmit =
    email.trim().length > 0 &&
    (mode === "forgot" ||
      (password.length > 0 &&
        (mode === "sign-in" || confirmPassword.length > 0)));

  const onCtaLayout = (event: LayoutChangeEvent) => {
    const target = event.target;
    if (!target || typeof target === "number") return;
    target.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const frame = { x, y, width, height };
      ctaFrameRef.current = frame;
      onCtaFrame?.(frame);
    });
  };

  const submit = () => {
    setLocalError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (mode === "forgot") {
      if (!trimmed) {
        setLocalError("Enter your email.");
        return;
      }
      void requestPasswordReset(trimmed).then((ok) => {
        if (ok) {
          setInfo(
            "If an account exists for that email, we sent a reset link. Check your inbox.",
          );
        }
      });
      return;
    }
    if (mode === "sign-up" && password !== confirmPassword) {
      setLocalError("Passwords don’t match.");
      return;
    }
    if (mode === "sign-up" && password.length < 8) {
      setLocalError("Use at least 8 characters for your password.");
      return;
    }
    const frame = ctaFrameRef.current;
    if (mode === "sign-up") {
      void signUp(trimmed, password, frame);
    } else {
      void signIn(trimmed, password, frame);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setLocalError(null);
    setInfo(null);
    setConfirmPassword("");
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const hint =
    mode === "sign-up"
      ? "Create an account to get started"
      : mode === "forgot"
        ? "We’ll email you a link to reset your password"
        : "Sign in to continue";

  const ctaLabel =
    mode === "sign-up"
      ? "Create account"
      : mode === "forgot"
        ? "Send reset link"
        : "Sign in";

  const loadingLabel =
    mode === "sign-up"
      ? "Creating account…"
      : mode === "forgot"
        ? "Sending…"
        : "Signing in…";

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor }]}
      pointerEvents={handOffActive ? "none" : "auto"}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {onBack && !handOffActive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to intro"
            className="min-h-11 justify-center px-6"
            disabled={busy}
            onPress={onBack}
          >
            <Text variant="label" tone="muted">
              ‹ Back
            </Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View
          style={[
            styles.center,
            { opacity: handOffActive ? 0 : 1 },
          ]}
        >
          <Text variant="display" className="text-center tracking-tight">
            Pearl
          </Text>
          <Text variant="label" tone="muted" className="mb-1 text-center">
            {hint}
          </Text>

          <Animated.View layout={LinearTransition} style={styles.fields}>
            <TextField
              ref={emailRef}
              accessibilityLabel="Email"
              autoFocus
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!busy && !handOffActive}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              returnKeyType={mode === "forgot" ? "go" : "next"}
              textContentType="emailAddress"
              value={email}
              onSubmitEditing={mode === "forgot" ? submit : undefined}
            />
            {mode !== "forgot" ? (
              <TextField
                accessibilityLabel="Password"
                autoComplete={mode === "sign-up" ? "new-password" : "password"}
                editable={!busy && !handOffActive}
                onChangeText={setPassword}
                onSubmitEditing={mode === "sign-in" ? submit : undefined}
                placeholder="Password"
                returnKeyType={mode === "sign-up" ? "next" : "go"}
                secureTextEntry
                textContentType={
                  mode === "sign-up" ? "newPassword" : "password"
                }
                value={password}
              />
            ) : null}
            {mode === "sign-up" ? (
              <TextField
                accessibilityLabel="Confirm password"
                autoComplete="new-password"
                editable={!busy && !handOffActive}
                onChangeText={setConfirmPassword}
                onSubmitEditing={submit}
                placeholder="Confirm password"
                returnKeyType="go"
                secureTextEntry
                textContentType="newPassword"
                value={confirmPassword}
              />
            ) : null}
          </Animated.View>

          <View onLayout={onCtaLayout} collapsable={false}>
            <Button
              disabled={!canSubmit || handOffActive}
              label={ctaLabel}
              loading={busy}
              loadingLabel={loadingLabel}
              onPress={submit}
              style={{ opacity: handOffActive ? 0 : 1 }}
            />
          </View>

          {info && !handOffActive ? (
            <Text
              accessibilityRole="text"
              variant="secondary"
              className="text-center"
            >
              {info}
            </Text>
          ) : null}

          {error && !handOffActive ? (
            <Text
              accessibilityRole="alert"
              variant="secondary"
              tone="destructive"
              className="text-center"
            >
              {error}
            </Text>
          ) : null}

          {!handOffActive && mode === "sign-in" ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-11 items-center justify-center"
              disabled={busy}
              onPress={() => switchMode("forgot")}
            >
              <Text variant="body" tone="muted" className="text-center">
                Forgot password?
              </Text>
            </Pressable>
          ) : null}

          {!handOffActive ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-11 items-center justify-center"
              disabled={busy}
              onPress={() =>
                switchMode(
                  mode === "forgot"
                    ? "sign-in"
                    : mode === "sign-in"
                      ? "sign-up"
                      : "sign-in",
                )
              }
            >
              <Text variant="body" tone="muted" className="text-center">
                {mode === "forgot" ? (
                  <>
                    Remembered it?{" "}
                    <Text weight="semibold" tone="default">
                      Sign in
                    </Text>
                  </>
                ) : mode === "sign-in" ? (
                  <>
                    Don’t have an account?{" "}
                    <Text weight="semibold" tone="default">
                      Create one
                    </Text>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Text weight="semibold" tone="default">
                      Sign in
                    </Text>
                  </>
                )}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backSpacer: { minHeight: 44 },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  fields: { gap: 12 },
});
