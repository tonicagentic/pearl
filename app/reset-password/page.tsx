"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || pending) {
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don’t match.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result?.error) {
        setError(result.error.message ?? "Unable to reset password.");
        setPending(false);
        return;
      }
      setDone(true);
      window.setTimeout(() => {
        router.replace("/");
      }, 1500);
    } catch {
      setError("Unable to reset password. Check your connection and try again.");
      setPending(false);
    }
  }

  if (linkError === "INVALID_TOKEN" || (!token && !done)) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Link expired</h1>
        <p className="text-sm text-muted-foreground">
          This password reset link is invalid or has expired. Request a new one
          from the sign-in screen.
        </p>
        <Button asChild className="h-11 w-full">
          <Link href="/">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Password updated</h1>
        <p className="text-sm text-muted-foreground">
          You can sign in with your new password.
        </p>
      </div>
    );
  }

  return (
    <form
      className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="space-y-1 pb-1">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Use at least 8 characters.
        </p>
      </div>
      <Input
        aria-label="New password"
        autoComplete="new-password"
        autoFocus
        disabled={pending}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="New password"
        type="password"
        value={password}
      />
      <Input
        aria-label="Confirm new password"
        autoComplete="new-password"
        disabled={pending}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirm password"
        type="password"
        value={confirmPassword}
      />
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button aria-busy={pending} className="h-11 w-full" disabled={pending} type="submit">
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
