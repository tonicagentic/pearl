"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { getPublicSocialProviders } from "@/lib/auth-social";
import { cn } from "@/lib/utils";

function resolveCallbackPath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}

/**
 * Continue with Google / Apple for the web gate. Uses better-auth browser
 * OAuth redirects. Buttons only render when the matching NEXT_PUBLIC_* client
 * ID is set (same values as the server GOOGLE_CLIENT_ID / APPLE_CLIENT_ID).
 */
export function SocialSignInButtons({
  callbackPath,
  className,
  disabled,
  onBeforeSignIn,
}: {
  readonly callbackPath?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onBeforeSignIn?: () => void;
}) {
  const providers = getPublicSocialProviders();
  const [pending, setPending] = useState<"google" | "apple" | null>(null);

  if (!providers.google && !providers.apple) {
    return null;
  }

  const startSocial = async (provider: "google" | "apple") => {
    if (disabled || pending) return;
    setPending(provider);
    try {
      onBeforeSignIn?.();
      const result = await authClient.signIn.social({
        provider,
        callbackURL: resolveCallbackPath(callbackPath),
      });
      if (result?.error) {
        setPending(null);
      }
    } catch {
      setPending(null);
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {providers.google ? (
        <Button
          aria-busy={pending === "google"}
          className="h-11 w-full gap-2"
          disabled={disabled || pending !== null}
          onClick={() => void startSocial("google")}
          type="button"
          variant="outline"
        >
          {pending === "google" ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <GoogleMark className="size-4" />
          )}
          {pending === "google" ? "Opening…" : "Continue with Google"}
        </Button>
      ) : null}
      {providers.apple ? (
        <Button
          aria-busy={pending === "apple"}
          className="h-11 w-full gap-2"
          disabled={disabled || pending !== null}
          onClick={() => void startSocial("apple")}
          type="button"
          variant="outline"
        >
          {pending === "apple" ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <AppleMark className="size-4" />
          )}
          {pending === "apple" ? "Opening…" : "Continue with Apple"}
        </Button>
      ) : null}
    </div>
  );
}

function GoogleMark({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleMark({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.365 1.43c0 1.14-.468 2.208-1.22 3.006-.78.82-2.058 1.447-3.13 1.36-.142-1.1.42-2.252 1.14-3.02.78-.82 2.12-1.42 3.21-1.346zM20.45 17.26c-.58 1.34-.86 1.93-1.61 3.11-1.04 1.63-2.51 3.66-4.34 3.68-1.62.02-2.04-1.06-4.25-1.05-2.2.01-2.67 1.07-4.29 1.05-1.83-.02-3.23-1.85-4.27-3.48C.23 17.9-.9 12.9.96 9.5c1.18-2.15 3.05-3.4 4.8-3.4 1.79 0 2.91 1.1 4.39 1.1 1.43 0 2.3-1.1 4.4-1.1 1.57 0 3.23 1.05 4.4 2.86-3.87 2.12-3.24 7.62.5 8.3z" />
    </svg>
  );
}
