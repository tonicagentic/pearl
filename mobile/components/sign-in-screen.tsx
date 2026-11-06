import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import Animated, { LinearTransition } from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useAuth, type AuthCtaFrame } from "@/src/auth";

type AuthMode = "sign-in" | "sign-up";

/** The sign-in / create-account gate: email/password through the agent's better-auth. */
export function SignInScreen({
  onCtaFrame,
  handOffActive = false,
}: {
  /** Latest measured CTA frame for the composer morph. */
  onCtaFrame?: (frame: AuthCtaFrame) => void;
  /** Hide interactive chrome while the morph overlay owns the transition. */
  handOffActive?: boolean;
}) {
  const { signIn, signUp, signInState, signInError } = useAuth();
  // SafeAreaView is a native codegen view — theme background via style, not className.
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const hintColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const ctaFrameRef = useRef<AuthCtaFrame | null>(null);
  const emailRef = useRef<TextInput>(null);

  const busy = signInState === "signing-in";
  const error = localError ?? signInError;
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (mode === "sign-in" || confirmPassword.length > 0);

  const onCtaLayout = (event: LayoutChangeEvent) => {
    event.target.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      const frame = { x, y, width, height };
      ctaFrameRef.current = frame;
      onCtaFrame?.(frame);
    });
  };

  const submit = () => {
    setLocalError(null);
    const trimmed = email.trim();
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
    setConfirmPassword("");
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor }]}
      pointerEvents={handOffActive ? "none" : "auto"}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View
          style={[
            styles.center,
            { opacity: handOffActive ? 0 : 1 },
          ]}
        >
          <Text
            style={[
              styles.title,
              foregroundColor ? { color: foregroundColor } : null,
            ]}
          >
            Pearl
          </Text>
          <Text
            style={[styles.hint, hintColor ? { color: hintColor } : null]}
          >
            {mode === "sign-up"
              ? "Create an account to get started"
              : "Sign in to continue"}
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
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
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
              label={mode === "sign-up" ? "Create account" : "Sign in"}
              loading={busy}
              loadingLabel={
                mode === "sign-up" ? "Creating account…" : "Signing in…"
              }
              onPress={submit}
              style={{ opacity: handOffActive ? 0 : 1 }}
            />
          </View>

          {error && !handOffActive ? (
            <Text
              accessibilityRole="alert"
              className="text-center text-sm text-destructive"
            >
              {error}
            </Text>
          ) : null}

          {!handOffActive ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-11 items-center justify-center"
              disabled={busy}
              onPress={() =>
                switchMode(mode === "sign-in" ? "sign-up" : "sign-in")
              }
            >
              <Text
                className="text-center text-[15px]"
                style={{ color: hintColor }}
              >
                {mode === "sign-in" ? (
                  <>
                    Don’t have an account?{" "}
                    <Text
                      style={{ color: foregroundColor, fontWeight: "600" }}
                    >
                      Create one
                    </Text>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Text
                      style={{ color: foregroundColor, fontWeight: "600" }}
                    >
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
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    fontSize: 34,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  hint: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 4,
  },
  fields: { gap: 12 },
});
