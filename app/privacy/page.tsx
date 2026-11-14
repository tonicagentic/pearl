import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pearl privacy (private beta)",
};

/**
 * Short statement for App Store Connect / TestFlight external review.
 * Not a full legal policy — states how the private beta treats account data.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pearl · private beta</p>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      </div>
      <div className="space-y-4 text-sm leading-6 text-muted-foreground">
        <p>
          Pearl is a private invite-only beta. Accounts are created with email
          and password. Each account’s chats, projects, issues, skills, and
          profile stay under that account.
        </p>
        <p>
          Connections (Gmail, GitHub, Calendar, and others) use that person’s
          own OAuth grants. One account cannot read another account’s
          connections or chats.
        </p>
        <p>
          Invitees use an included monthly usage allowance paid by the
          operator. There is no Stripe charge for invited beta accounts. When
          the allowance is used, chatting pauses until the next calendar month.
        </p>
        <p>
          You can delete your account from Settings in the app. Deletion
          removes your Pearl account data from the hosted service and revokes
          connection grants Pearl holds for you.
        </p>
        <p>
          Questions about this beta: contact the person who invited you.
        </p>
      </div>
      <Link
        className="text-sm underline underline-offset-2"
        href="/"
      >
        Back to Pearl
      </Link>
    </main>
  );
}
