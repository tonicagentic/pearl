"use client";

import { Loader2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type FormMode = "sign-in" | "sign-up" | "forgot";

export function EmailSignInForm({
  callbackPath,
  onBeforeSignIn,
}: {
  readonly callbackPath?: string;
  readonly onBeforeSignIn?: () => void;
}) {
  const [mode, setMode] = useState<FormMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resolvePostAuthPath(): Promise<string> {
    try {
      const response = await fetch("/api/billing/status");
      if (!response.ok) {
        return resolveCallbackPath(callbackPath);
      }
      const body = (await response.json()) as {
        enabled?: boolean;
        needsCheckout?: boolean;
        allowed?: boolean;
        exempt?: boolean;
      };
      if (body.enabled && body.needsCheckout) {
        return "/billing";
      }
    } catch {
      // Fall through to the normal callback.
    }
    return resolveCallbackPath(callbackPath);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email || pending) {
      return;
    }

    if (mode === "forgot") {
      setError(null);
      setInfo(null);
      setPending(true);
      try {
        const redirectTo = `${window.location.origin}/reset-password`;
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo,
        });
        if (result?.error) {
          setError(result.error.message ?? "Unable to send reset link.");
          setPending(false);
          return;
        }
        setInfo(
          "If an account exists for that email, we sent a reset link. Check your inbox.",
        );
        setPending(false);
      } catch {
        setError("Unable to send reset link. Check your connection and try again.");
        setPending(false);
      }
      return;
    }

    if (!password) {
      return;
    }

    if (mode === "sign-up") {
      if (password.length < 8) {
        setError("Use at least 8 characters for your password.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don’t match.");
        return;
      }
    }

    setError(null);
    setInfo(null);
    setPending(true);

    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              email,
              password,
              name: email.split("@")[0] ?? email,
            })
          : await authClient.signIn.email({ email, password });

      if (result?.error) {
        setError(result.error.message ?? "Unable to continue.");
        setPending(false);
        return;
      }

      onBeforeSignIn?.();
      window.location.assign(await resolvePostAuthPath());
    } catch {
      setError("Unable to continue. Check your connection and try again.");
      setPending(false);
    }
  }

  function switchMode(next: FormMode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setConfirmPassword("");
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Input
        aria-label="Email"
        autoComplete="email"
        autoFocus
        disabled={pending}
        id="eve-chat-email"
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        type="email"
        value={email}
      />
      {mode !== "forgot" ? (
        <Input
          aria-label="Password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          disabled={pending}
          id="eve-chat-email-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      ) : null}
      {mode === "sign-up" ? (
        <Input
          aria-label="Confirm password"
          autoComplete="new-password"
          disabled={pending}
          id="eve-chat-email-password-confirm"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          type="password"
          value={confirmPassword}
        />
      ) : null}
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
          {info}
        </p>
      ) : null}
      <Button aria-busy={pending} className="h-11 w-full" disabled={pending} type="submit">
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {pending
          ? mode === "forgot"
            ? "Sending…"
            : mode === "sign-up"
              ? "Creating account…"
              : "Signing in…"
          : mode === "forgot"
            ? "Send reset link"
            : mode === "sign-up"
              ? "Create account"
              : "Continue"}
      </Button>
      {mode === "sign-in" ? (
        <button
          className="w-full text-center text-xs text-muted-foreground underline"
          disabled={pending}
          onClick={() => switchMode("forgot")}
          type="button"
        >
          Forgot password?
        </button>
      ) : null}
      <button
        className="w-full text-center text-xs text-muted-foreground underline"
        disabled={pending}
        onClick={() =>
          switchMode(
            mode === "forgot"
              ? "sign-in"
              : mode === "sign-in"
                ? "sign-up"
                : "sign-in",
          )
        }
        type="button"
      >
        {mode === "forgot"
          ? "Back to sign in"
          : mode === "sign-in"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

function resolveCallbackPath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  return path;
}
