import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pearl terms of service",
  description:
    "Terms of service for Pearl, a personal agent operated by Tonic Agentic.",
};

/** Public terms of service for OAuth consent / app store listings. */
export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pearl by Tonic Agentic</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Terms of service
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated: November 14, 2026
        </p>
      </div>

      <div className="space-y-6 text-sm leading-6 text-muted-foreground">
        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Service</h2>
          <p>
            Pearl is a personal agent product operated by Tonic Agentic at
            pearl.tonicagentic.com. By creating an account or using Pearl you
            agree to these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Your account</h2>
          <p>
            You are responsible for activity under your account and for keeping
            credentials secure. You must provide accurate contact information
            and may only connect services (such as Gmail) that you are
            authorized to use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Connected services
          </h2>
          <p>
            Optional integrations (including Google Gmail) run under your own
            OAuth grants. Pearl acts only on those connections to provide the
            features you use in the product. You can disconnect integrations or
            delete your account at any time from Settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Acceptable use</h2>
          <p>
            Do not use Pearl to violate law, abuse third-party APIs, spam, or
            attempt to access other users’ data. We may suspend accounts that
            abuse the service or violate these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Privacy</h2>
          <p>
            How we handle data is described in the{" "}
            <Link
              className="underline underline-offset-2 text-foreground"
              href="/privacy"
            >
              privacy policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-medium text-foreground">Contact</h2>
          <p>
            Questions:{" "}
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
        <Link className="underline underline-offset-2" href="/privacy">
          Privacy
        </Link>
      </nav>
    </main>
  );
}
