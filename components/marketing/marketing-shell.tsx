"use client";

import { useState, type ReactNode } from "react";
import { SignInModal } from "@/components/auth/sign-in-modal";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import type { AuthMode } from "@/lib/chat/types";

type MarketingShellChildren =
  | ReactNode
  | ((api: { onGetStarted: () => void }) => ReactNode);

export function MarketingShell({
  authMode,
  callbackPath = "/",
  children,
  githubStars,
}: {
  readonly authMode: AuthMode;
  readonly callbackPath?: string;
  readonly children: MarketingShellChildren;
  readonly githubStars: number | null;
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const openAuth = () => setAuthOpen(true);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingHeader
        githubStars={githubStars}
        onGetStarted={openAuth}
        onSignIn={openAuth}
      />
      <main>
        {typeof children === "function"
          ? children({ onGetStarted: openAuth })
          : children}
      </main>
      <MarketingFooter />
      <SignInModal
        authMode={authMode}
        callbackPath={callbackPath}
        onOpenChange={setAuthOpen}
        open={authOpen}
      />
    </div>
  );
}
