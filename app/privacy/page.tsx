import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pearl privacy policy",
  description:
    "How Pearl accesses, uses, stores, and deletes account data and Google user data, including Gmail Limited Use commitments.",
};

/**
 * Public privacy policy for App Store review and Google OAuth verification.
 * Hosted on the same domain as the application home page (/about).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pearl by Tonic Agentic</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Privacy policy
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated: November 14, 2026
        </p>
      </div>

      <div className="space-y-6 text-sm leading-6 text-muted-foreground">
        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Overview</h2>
          <p>
            Pearl is a personal agent operated by Tonic Agentic
            (pearl.tonicagentic.com). This policy explains how Pearl handles
            account data and Google user data when you use the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Account data
          </h2>
          <p>
            Accounts are created with email and password or Sign in with
            Vercel. Each account’s chats, projects, issues, skills, and profile
            stay under that account. One account cannot read another account’s
            chats or connections.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Google / Gmail data
          </h2>
          <p>
            If you connect Gmail, Pearl uses Google OAuth through Vercel Connect
            to obtain tokens scoped to your Google Account. Pearl may request:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="text-foreground">gmail.readonly</code> — search
              and read messages and labels for triage and summaries
            </li>
            <li>
              <code className="text-foreground">gmail.compose</code> — create
              drafts and send mail you approve
            </li>
            <li>
              <code className="text-foreground">gmail.modify</code> — archive,
              mark read, and apply labels in batches you approve
            </li>
          </ul>
          <p>
            Pearl’s servers use those tokens to call the Gmail API so the agent
            can perform the features above inside the Pearl app (web and
            mobile). Message content may be processed transiently to generate
            summaries, drafts, and tool results shown to you. Pearl does not
            sell Google user data, does not use it for advertising or credit
            decisions, and does not transfer it to data brokers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Limited Use (Google restricted scopes)
          </h2>
          <p>
            Pearl’s use of information received from Google APIs complies with
            the Google API Services User Data Policy, including the Limited Use
            requirements. Specifically:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Gmail data is used only to provide or improve user-facing Pearl
              features that are prominent in the product (inbox triage,
              drafting, sending with approval, labeling/archiving).
            </li>
            <li>
              Pearl does not transfer Google user data except to provide those
              features with your consent, for security investigations, to
              comply with law, or as part of a merger/acquisition with prior
              consent.
            </li>
            <li>
              Pearl does not allow humans to read Gmail content except with
              your affirmative agreement for specific messages, when required
              for security or legal compliance, or when data is aggregated for
              internal operations consistent with applicable law.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Storage and retention
          </h2>
          <p>
            Connection grants are stored by Vercel Connect; Pearl keeps
            mailbox metadata needed to run the product (for example which
            Gmail accounts you linked). Chat transcripts and tool results that
            include mail snippets may be stored in your Pearl account database
            until you delete them or delete your account. Access tokens are
            not stored in Pearl application secrets; Connect issues them when
            Pearl needs to call Gmail.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Deletion and disconnection
          </h2>
          <p>
            You can disconnect Gmail from Settings → Email / Plugins. You can
            delete your Pearl account from Settings. Deletion removes your
            Pearl account data from the hosted service and revokes connection
            grants Pearl holds for you. You can also revoke Pearl’s access in
            your Google Account security settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Contact</h2>
          <p>
            Questions about privacy or this policy:{" "}
            <a
              className="underline underline-offset-2 text-foreground"
              href="mailto:alex@tonicagentic.com"
            >
              alex@tonicagentic.com
            </a>
            .
          </p>
        </section>
      </div>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link className="underline underline-offset-2" href="/about">
          About Pearl
        </Link>
        <Link className="underline underline-offset-2" href="/">
          Open Pearl
        </Link>
      </nav>
    </main>
  );
}
