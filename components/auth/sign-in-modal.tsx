"use client";

import { LockKeyholeIcon, MailIcon } from "lucide-react";
import { EmailSignInForm } from "@/components/auth/email-sign-in-form";
import { PasswordSignInForm } from "@/components/auth/password-sign-in-form";
import { SignInButton } from "@/components/auth/sign-in-button";
import { PearlIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuthMode } from "@/lib/chat/types";

export function SignInModal({
  authMode,
  callbackPath,
  disabled,
  onBeforeSignIn,
  onOpenChange,
  open,
}: {
  readonly authMode: AuthMode;
  readonly callbackPath?: string;
  readonly disabled?: boolean;
  readonly onBeforeSignIn?: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const usesPassword = authMode === "password";
  const usesEmailPassword = authMode === "email";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full border border-border bg-muted">
            {usesPassword ? (
              <LockKeyholeIcon className="size-4 text-foreground" />
            ) : usesEmailPassword ? (
              <MailIcon className="size-4 text-foreground" />
            ) : (
              <PearlIcon className="size-4 text-foreground" />
            )}
          </div>
          <DialogTitle>
            {usesPassword
              ? "Enter chat password"
              : usesEmailPassword
                ? "Sign in to get started"
                : "Sign up or in to get started"}
          </DialogTitle>
          <DialogDescription>
            {usesPassword
              ? "Use the password configured by the person who deployed this agent."
              : usesEmailPassword
                ? "Sign in with the email and password provisioned by the person who deployed this agent."
                : "Connect your Vercel account to send messages and save sessions."}
          </DialogDescription>
        </DialogHeader>
        {usesPassword ? (
          <PasswordSignInForm
            callbackPath={callbackPath}
            onBeforeSignIn={onBeforeSignIn}
          />
        ) : usesEmailPassword ? (
          <EmailSignInForm
            callbackPath={callbackPath}
            onBeforeSignIn={onBeforeSignIn}
          />
        ) : (
          <SignInButton
            callbackPath={callbackPath}
            className="h-11 w-full"
            disabled={disabled}
            onBeforeSignIn={onBeforeSignIn}
            variant="outline"
          >
            Continue with Vercel
          </SignInButton>
        )}
      </DialogContent>
    </Dialog>
  );
}
