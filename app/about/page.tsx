import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pearl — personal agent for clear thinking",
  description:
    "Pearl is a personal agent for thinking, research, writing, and email triage. Connect your own Gmail and other accounts; your data stays under your account.",
};

/**
 * Public application home page for Google OAuth consent / verification.
 * Must remain reachable without signing in and must describe the product
 * with a link to the privacy policy on the same domain.
 */
export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Pearl by Tonic Agentic</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A personal agent for clear thinking
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          Pearl helps you think, research, write, and manage email. It runs as
          your own agent on the web and on mobile. You sign in with your own
          account and optionally connect services such as Gmail so Pearl can
          search, draft, send, and organize mail on your behalf.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium tracking-tight">What Pearl does</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            Chat for research, writing, planning, and day-to-day decisions.
          </li>
          <li>
            Connect your Gmail to triage inbox threads, draft replies, send
            messages you approve, and apply labels or archive in bulk.
          </li>
          <li>
            Use other optional connections (Calendar, Drive, GitHub, and more)
            when you authorize them from Settings.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium tracking-tight">Gmail access</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          When you connect Gmail, Pearl requests only the scopes needed to read
          mail, create drafts, send mail you approve, and modify labels or
          archive status. Mail data is used only to provide those features to
          you inside Pearl. It is not sold or used for advertising. You can
          disconnect Gmail or delete your account at any time from Settings.
        </p>
      </section>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link className="underline underline-offset-2" href="/privacy">
          Privacy policy
        </Link>
        <Link className="underline underline-offset-2" href="/terms">
          Terms of service
        </Link>
        <Link className="underline underline-offset-2" href="/">
          Open Pearl
        </Link>
        <a
          className="underline underline-offset-2"
          href="mailto:alex@tonicagentic.com"
        >
          Support
        </a>
      </nav>
    </main>
  );
}
