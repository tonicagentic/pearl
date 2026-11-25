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
import * as AppleAuthentication from "expo-apple-authentication";
import { router, Stack, useNavigation } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ChevronLeftIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { PearlIntroPager } from "@/components/intro/pearl-intro-pager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text, TEXT_METRICS } from "@/components/ui/text";
import { useAuth, type AuthCtaFrame } from "@/src/auth";
import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
} from "@/src/social-auth";

type GatePhase = "gate" | "email";
type AuthFlow = "sign-up" | "sign-in" | "forgot";
type AuthStep = "email" | "password";

/**
 * `full` — local phase swap (signup sheet).
 * `gate` / `email` — stack screens; Continue with Email pushes `/sign-in/email`.
 */
export type SignInVariant = "full" | "gate" | "email";

const INPUT_FONT = 28;
const INPUT_LINE = 34;

/**
 * Signed-out gate: compact Pearl carousel + continue methods, then email.
 * Sign-in vs sign-up is inferred from the email probe — never a user choice.
 */
export function SignInScreen({
  onCtaFrame,
  onBack,
  handOffActive = false,
  skipIntro = false,
  variant = "full",
}: {
  /** Latest measured CTA frame for the composer morph. */
  onCtaFrame?: (frame: AuthCtaFrame) => void;
  /** Dismiss when this screen was opened on top of the app (guest sign-in). */
  onBack?: () => void;
  /** Hide interactive chrome while the morph overlay owns the transition. */
  handOffActive?: boolean;
  /**
   * Hide the carousel (guest push / signup sheet). Cold signed-out entry
   * keeps the swipeable intro above the continue buttons.
   */
  skipIntro?: boolean;
  /** How gate ↔ email are connected — see `SignInVariant`. */
  variant?: SignInVariant;
}) {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    requestPasswordReset,
    checkEmailExists,
    signInState,
    signInError,
  } = useAuth();
  const googleAvailable = isGoogleSignInAvailable();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  /** Pushed `/sign-in/email` route — native liquid-glass back + swipe-to-pop. */
  const isStackEmail = variant === "email";

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

  const [phase, setPhase] = useState<GatePhase>(
    variant === "email" ? "email" : "gate",
  );
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
  const showingGate = variant === "gate" || phase === "gate";
  const showingEmail = variant === "email" || phase === "email";

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
    let cancelled = false;
    void isAppleSignInAvailable().then((ok) => {
      if (!cancelled) setAppleAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (handOffActive || !showingEmail) return;
    const id = requestAnimationFrame(() => {
      if (step === "email" || flow === "forgot") emailRef.current?.focus();
      else passwordRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [step, flow, handOffActive, showingEmail]);

  // Swipe-back / toolbar back: step password → email first, then pop.
  useEffect(() => {
    if (!isStackEmail) return;

    navigation.setOptions({
      gestureEnabled: !busy && !handOffActive,
    });

    const unsub = navigation.addListener("beforeRemove", (event) => {
      if (busy || handOffActive) {
        event.preventDefault();
        return;
      }
      if (flow === "forgot") {
        event.preventDefault();
        setLocalError(null);
        setInfo(null);
        setFlow("sign-in");
        setStep("password");
        return;
      }
      if (step === "password") {
        event.preventDefault();
        setLocalError(null);
        setInfo(null);
        setStep("email");
        setPassword("");
        setConfirmPassword("");
      }
    });

    return unsub;
  }, [busy, flow, handOffActive, isStackEmail, navigation, step]);

  const progressSegments = Array.from({ length: stepCount }, (_, i) => (
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
  ));

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

  const resetEmailFields = () => {
    clearMessages();
    setFlow("sign-up");
    setStep("email");
    setPassword("");
    setConfirmPassword("");
  };

  const leaveEmailToGate = () => {
    resetEmailFields();
    if (variant === "email") {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace("/sign-in");
      return;
    }
    setPhase("gate");
  };

  const goToEmail = () => {
    clearMessages();
    setFlow("sign-up");
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    if (variant === "gate") {
      router.push("/sign-in/email");
      return;
    }
    setPhase("email");
  };

  const onGateBack = () => {
    if (busy || handOffActive) return;
    if (showingEmail) {
      if (flow === "forgot") {
        clearMessages();
        setFlow("sign-in");
        setStep("password");
        setInfo(null);
        return;
      }
      if (step === "password") {
        clearMessages();
        setStep("email");
        setPassword("");
        setConfirmPassword("");
        return;
      }
      leaveEmailToGate();
      return;
    }
    onBack?.();
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
          : "Enter your password";

  const subtitle =
    flow === "forgot"
      ? "We’ll email you a link to reset it"
      : step === "email"
        ? "We’ll create an account if you’re new"
        : flow === "sign-up"
          ? "At least 8 characters"
          : trimmedEmail;

  const ctaLabel =
    checkingEmail
      ? "Checking…"
      : signInState === "signing-in"
        ? flow === "forgot"
          ? "Sending…"
          : "Continuing…"
        : flow === "forgot"
          ? "Send reset link"
          : "Continue";

  const showBack = !handOffActive;

  if (showingGate) {
    return (
      <SafeAreaView
        style={[StyleSheet.absoluteFill, { backgroundColor }]}
        pointerEvents={handOffActive ? "none" : "auto"}
      >
        <View
          style={[
            styles.gateRoot,
            { opacity: handOffActive ? 0 : 1 },
          ]}
        >
          {onBack && !handOffActive ? (
            <View style={styles.gateTopBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={12}
                onPress={onGateBack}
                style={styles.backHit}
              >
                <Icon
                  as={ChevronLeftIcon}
                  className="size-5 text-foreground"
                />
                <Text variant="body" weight="medium">
                  Back
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!skipIntro ? (
            <View style={styles.carousel}>
              <PearlIntroPager compact showActions={false} />
            </View>
          ) : (
            <View style={styles.methodsHeader}>
              <Text
                variant="title"
                weight="semibold"
                className="text-center tracking-tight"
              >
                Continue to Pearl
              </Text>
              <Text variant="body" tone="muted" className="text-center">
                Use any option — new or returning
              </Text>
            </View>
          )}

          <View style={styles.methodStack}>
            {googleAvailable ? (
              <Button
                label="Continue with Google"
                variant="secondary"
                loading={busy}
                disabled={busy || handOffActive}
                onPress={() => void signInWithGoogle()}
              />
            ) : null}
            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={styles.appleButton}
                onPress={() => {
                  if (busy || handOffActive) return;
                  void signInWithApple();
                }}
              />
            ) : null}
            <Button
              label="Continue with Email"
              disabled={busy || handOffActive}
              onPress={goToEmail}
            />
            {error && showingGate && !handOffActive ? (
              <Text
                accessibilityRole="alert"
                variant="secondary"
                style={{ color: destructiveColor, textAlign: "center" }}
              >
                {error}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor }]}
      // Stack email: top inset comes from the transparent header.
      // Leave bottom to KeyboardAvoidingView so Continue stays above the keyboard.
      edges={isStackEmail ? ["left", "right"] : ["top", "left", "right"]}
      pointerEvents={handOffActive ? "none" : "auto"}
    >
      {isStackEmail ? (
        <>
          <Stack.Screen
            options={{
              headerShown: true,
              title: "",
              headerTransparent: Platform.OS === "ios",
              headerShadowVisible: false,
              headerTintColor: foregroundColor,
              headerStyle:
                Platform.OS === "ios" ? undefined : { backgroundColor },
              // iOS: Stack.Toolbar.Button owns the liquid-glass chevron.
              headerBackVisible: Platform.OS !== "ios",
              headerBackButtonDisplayMode: "minimal",
              headerLeft: Platform.OS === "ios" ? () => null : undefined,
              headerTitle: () => (
                <View style={styles.headerProgress}>{progressSegments}</View>
              ),
            }}
          />
          {Platform.OS === "ios" ? (
            <Stack.Toolbar placement="left">
              {/*
                Native Toolbar.Button — circular liquid glass + press.
                Custom GlassView on a flat black field reads as invisible.
              */}
              <Stack.Toolbar.Button
                icon="chevron.left"
                accessibilityLabel="Back"
                hidden={busy || handOffActive}
                onPress={onGateBack}
              />
            </Stack.Toolbar>
          ) : null}
        </>
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View
          style={[
            styles.column,
            { opacity: handOffActive ? 0 : 1 },
            isStackEmail
              ? {
                  paddingTop:
                    Platform.OS === "ios" ? insets.top + 52 : 8,
                }
              : null,
          ]}
        >
          {isStackEmail ? null : (
            <View style={styles.topBar}>
              {showBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  disabled={busy}
                  hitSlop={12}
                  onPress={onGateBack}
                  style={styles.backHit}
                >
                  <Icon
                    as={ChevronLeftIcon}
                    className="size-5 text-foreground"
                  />
                  <Text variant="body" weight="medium">
                    Back
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.cornerHit} />
              )}
              <View style={styles.progressRow}>{progressSegments}</View>
              <View style={styles.cornerHit} />
            </View>
          )}

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
                onPress={() => {
                  clearMessages();
                  setFlow("forgot");
                  setStep("email");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                <Text variant="body" tone="muted" className="text-center">
                  Forgot password?
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
  gateRoot: {
    flex: 1,
    paddingBottom: 12,
  },
  gateTopBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  carousel: {
    flex: 1,
    minHeight: 0,
  },
  methodsHeader: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  methodStack: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  appleButton: {
    width: "100%",
    height: 48,
  },
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
    alignItems: "center",
    gap: 6,
  },
  headerProgress: {
    width: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  backHit: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginLeft: -6,
  },
  cornerHit: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: 8,
    minWidth: 48,
  },
  header: {
    paddingTop: 12,
    gap: 6,
    alignItems: "center",
  },
  fieldStage: {
    flex: 1,
    minHeight: 0,
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
