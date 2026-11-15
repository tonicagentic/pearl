import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Text, TEXT_METRICS } from "@/components/ui/text";
import { useAuth, type AuthCtaFrame } from "@/src/auth";

type AuthFlow = "sign-up" | "sign-in" | "forgot";
type AuthStep = "email" | "password";

const INPUT_FONT = 28;
const INPUT_LINE = 34;

/** Email-first sign-up / sign-in gate (Cosmos-style stepped chrome). */
export function SignInScreen({
  onCtaFrame,
  onBack: _onBack,
  handOffActive = false,
}: {
  /** Latest measured CTA frame for the composer morph. */
  onCtaFrame?: (frame: AuthCtaFrame) => void;
  /** Unused — kept for call-site compatibility. */
  onBack?: () => void;
  /** Hide interactive chrome while the morph overlay owns the transition. */
  handOffActive?: boolean;
}) {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    checkEmailExists,
    signInState,
    signInError,
  } = useAuth();

  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const primaryFg = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const destructiveColor = useCSSVariable("--color-destructive") as
    | string
    | undefined;

  const [flow, setFlow] = useState<AuthFlow>("sign-up");
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const ctaFrameRef = useRef<AuthCtaFrame | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const busy = signInState === "signing-in" || checkingEmail;
  const error = localError ?? signInError;
  const trimmedEmail = email.trim();
  const emailOk = trimmedEmail.includes("@") && trimmedEmail.includes(".");

  const stepCount = flow === "forgot" ? 1 : 2;
  const stepIndex = flow === "forgot" || step === "email" ? 0 : 1;

  const canContinue =
    !busy &&
    !handOffActive &&
    (step === "email"
      ? emailOk
      : flow === "sign-in"
        ? password.length > 0
        : password.length >= 8 &&
          confirmPassword.length > 0 &&
          password === confirmPassword);

  useEffect(() => {
    if (handOffActive) return;
    const id = requestAnimationFrame(() => {
      if (step === "email") emailRef.current?.focus();
      else passwordRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [step, flow, handOffActive]);

  const onCtaLayout = (event: LayoutChangeEvent) => {
    const target = event.target;
    if (!target || typeof target === "number") return;
    target.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        const frame = { x, y, width, height };
        ctaFrameRef.current = frame;
        onCtaFrame?.(frame);
      },
    );
  };

  const clearMessages = () => {
    setLocalError(null);
    setInfo(null);
  };

  const switchFlow = (next: AuthFlow) => {
    clearMessages();
    setFlow(next);
    setStep("email");
    setPassword("");
    setConfirmPassword("");
  };

  const goToPassword = async () => {
    if (!emailOk) {
      setLocalError("Enter a valid email address.");
      return;
    }
    clearMessages();
    setCheckingEmail(true);
    try {
      const exists = await checkEmailExists(trimmedEmail);
      if (exists === true) {
        setFlow("sign-in");
        setConfirmPassword("");
      } else if (exists === false && flow !== "forgot") {
        setFlow("sign-up");
      }
      setStep("password");
    } finally {
      setCheckingEmail(false);
    }
  };

  const submitAuth = () => {
    clearMessages();
    const frame = ctaFrameRef.current;
    if (flow === "sign-up") {
      if (password.length < 8) {
        setLocalError("Use at least 8 characters for your password.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords don’t match.");
        return;
      }
      void signUp(trimmedEmail, password, frame);
      return;
    }
    if (password.length === 0) {
      setLocalError("Enter your password.");
      return;
    }
    void signIn(trimmedEmail, password, frame);
  };

  const submitForgot = () => {
    clearMessages();
    if (!emailOk) {
      setLocalError("Enter a valid email address.");
      return;
    }
    void requestPasswordReset(trimmedEmail).then((ok) => {
      if (ok) {
        setInfo(
          "If an account exists for that email, we sent a reset link. Check your inbox.",
        );
      }
    });
  };

  const onContinue = () => {
    if (flow === "forgot") {
      submitForgot();
      return;
    }
    if (step === "email") {
      void goToPassword();
      return;
    }
    submitAuth();
  };

  const title =
    flow === "forgot"
      ? "Reset your password"
      : step === "email"
        ? "Enter your email address"
        : flow === "sign-up"
          ? "Create a password"
          : "Welcome back";

  const subtitle =
    flow === "forgot"
      ? "We’ll email you a link to reset it"
      : step === "email"
        ? flow === "sign-up"
          ? "Sign up or get started"
          : "Welcome back"
        : flow === "sign-up"
          ? "At least 8 characters"
          : trimmedEmail;

  const ctaLabel =
    checkingEmail
      ? "Checking…"
      : signInState === "signing-in"
        ? flow === "forgot"
          ? "Sending…"
          : flow === "sign-up"
            ? "Creating account…"
            : "Signing in…"
        : flow === "forgot"
          ? "Send reset link"
          : step === "email"
            ? "Continue"
            : flow === "sign-up"
              ? "Create account"
              : "Sign in";

  const cornerLabel =
    flow === "sign-up" ? "Log In" : flow === "sign-in" ? "Sign Up" : "Log In";

  const onCornerPress = () => {
    if (busy) return;
    switchFlow(flow === "sign-up" ? "sign-in" : "sign-up");
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
          style={[styles.column, { opacity: handOffActive ? 0 : 1 }]}
        >
          <View style={styles.topBar}>
            <View style={styles.progressRow}>
              {Array.from({ length: stepCount }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor:
                        i <= stepIndex
                          ? (foregroundColor ?? "#111")
                          : (borderColor ?? "#e5e5e5"),
                    },
                  ]}
                />
              ))}
            </View>
            {!handOffActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cornerLabel}
                disabled={busy}
                hitSlop={8}
                onPress={onCornerPress}
                style={styles.cornerHit}
              >
                <Text variant="body" tone="muted" weight="medium">
                  {cornerLabel}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.cornerHit} />
            )}
          </View>

          <View style={styles.header}>
            <Text
              variant="title"
              weight="semibold"
              className="text-center tracking-tight"
            >
              {title}
            </Text>
            <Text
              variant="body"
              tone="muted"
              className="text-center"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <View style={styles.fieldStage}>
            {step === "email" || flow === "forgot" ? (
              <TextInput
                ref={emailRef}
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                autoFocus
                editable={!busy && !handOffActive}
                keyboardType="email-address"
                onChangeText={(value) => {
                  setEmail(value);
                  clearMessages();
                }}
                onSubmitEditing={onContinue}
                placeholder="Email address"
                placeholderTextColor={mutedColor ?? undefined}
                returnKeyType="go"
                textAlign="center"
                textContentType="emailAddress"
                value={email}
                style={[
                  styles.largeInput,
                  { color: foregroundColor },
                  Platform.OS === "android"
                    ? { includeFontPadding: false }
                    : null,
                ]}
              />
            ) : (
              <View style={styles.passwordStack}>
                <TextInput
                  ref={passwordRef}
                  accessibilityLabel="Password"
                  autoComplete={
                    flow === "sign-up" ? "new-password" : "password"
                  }
                  editable={!busy && !handOffActive}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearMessages();
                  }}
                  onSubmitEditing={() => {
                    if (flow === "sign-up") confirmRef.current?.focus();
                    else onContinue();
                  }}
                  placeholder="Password"
                  placeholderTextColor={mutedColor ?? undefined}
                  returnKeyType={flow === "sign-up" ? "next" : "go"}
                  secureTextEntry
                  textAlign="center"
                  textContentType={
                    flow === "sign-up" ? "newPassword" : "password"
                  }
                  value={password}
                  style={[
                    styles.largeInput,
                    { color: foregroundColor },
                    Platform.OS === "android"
                      ? { includeFontPadding: false }
                      : null,
                  ]}
                />
                {flow === "sign-up" ? (
                  <TextInput
                    ref={confirmRef}
                    accessibilityLabel="Confirm password"
                    autoComplete="new-password"
                    editable={!busy && !handOffActive}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      clearMessages();
                    }}
                    onSubmitEditing={onContinue}
                    placeholder="Confirm password"
                    placeholderTextColor={mutedColor ?? undefined}
                    returnKeyType="go"
                    secureTextEntry
                    textAlign="center"
                    textContentType="newPassword"
                    value={confirmPassword}
                    style={[
                      styles.largeInput,
                      { color: foregroundColor },
                      Platform.OS === "android"
                        ? { includeFontPadding: false }
                        : null,
                    ]}
                  />
                ) : null}
              </View>
            )}

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
                style={{ color: destructiveColor, textAlign: "center" }}
              >
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            {flow === "sign-in" && step === "password" && !handOffActive ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 items-center justify-center"
                disabled={busy}
                onPress={() => switchFlow("forgot")}
              >
                <Text variant="body" tone="muted" className="text-center">
                  Forgot password?
                </Text>
              </Pressable>
            ) : step === "password" && !handOffActive ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 items-center justify-center"
                disabled={busy}
                onPress={() => {
                  clearMessages();
                  setStep("email");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                <Text variant="body" tone="muted" className="text-center">
                  Use a different email
                </Text>
              </Pressable>
            ) : (
              <View style={styles.footerSpacer} />
            )}

            <View onLayout={onCtaLayout} collapsable={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !canContinue,
                  busy,
                }}
                disabled={!canContinue}
                onPress={onContinue}
                style={[
                  styles.cta,
                  {
                    backgroundColor: canContinue
                      ? (foregroundColor ?? "#111")
                      : (borderColor ?? "#e5e5e5"),
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="semibold"
                  style={{ color: primaryFg ?? "#fff" }}
                >
                  {ctaLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 44,
    paddingTop: 4,
  },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  cornerHit: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: 8,
  },
  header: {
    paddingTop: 28,
    gap: 6,
    alignItems: "center",
  },
  fieldStage: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  passwordStack: {
    gap: 20,
  },
  largeInput: {
    fontSize: INPUT_FONT,
    lineHeight: INPUT_LINE,
    fontWeight: "500",
    paddingVertical: 8,
    // Keep vertical metrics stable vs label TextField chrome.
    minHeight: TEXT_METRICS.display.lineHeight + 16,
  },
  footer: {
    gap: 8,
    paddingBottom: 12,
  },
  footerSpacer: {
    minHeight: 44,
  },
  cta: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
