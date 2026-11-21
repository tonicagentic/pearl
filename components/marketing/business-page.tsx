"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarketingContainer } from "@/components/marketing/section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { marketingType } from "@/components/marketing/type";
import type { AuthMode } from "@/lib/chat/types";
import {
  DIRECTORY_CATEGORIES,
  DIRECTORY_CATEGORY_LABELS,
  filterDirectoryListings,
  type DirectoryCategory,
  type PublicDirectoryListing,
} from "@/lib/directory/shared";
import { cn } from "@/lib/utils";

const WHY_JOIN = [
  {
    title: "People with a job to do",
    body: "Folks ask Pearl for a salon, a photographer, a place to eat. Pearl looks for a fit — yours can be one of them.",
  },
  {
    title: "Free to be discovered",
    body: "No listing fee or subscription to join the directory. You can update or ask to be removed anytime.",
  },
  {
    title: "You stay in control",
    body: "Pearl suggests and helps coordinate. You confirm the work and deliver it your way.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    title: "Tell us what you do",
    body: "Services, location, and how Pearl should reach you.",
  },
  {
    title: "Pearl finds a match",
    body: "When someone’s request fits, Pearl can point them your way.",
  },
  {
    title: "You take it from here",
    body: "Confirm the details. Deliver your best.",
  },
] as const;

const FAQS = [
  {
    question: "Who can join?",
    answer:
      "Local businesses and creatives — salons, cafés, restaurants, photographers, designers, trainers, and similar. If you’re unsure, submit anyway and we’ll sort it.",
  },
  {
    question: "Does it cost anything?",
    answer:
      "No. Joining the directory is free. There is no subscription or listing fee in this early version.",
  },
  {
    question: "How will Pearl contact me?",
    answer:
      "Using the email or phone you share when you join. Pearl won’t publish those publicly on this page.",
  },
  {
    question: "Does joining guarantee customers?",
    answer:
      "No. Listing means Pearl can suggest you when you’re a good fit — volume depends on what people ask for.",
  },
  {
    question: "Pearl already mentioned my business. What next?",
    answer:
      "Join below so we have current contact details and can keep you in the directory on purpose.",
  },
] as const;

const fieldLabelClass =
  "mb-1.5 block text-sm font-medium tracking-tight text-foreground";

export function BusinessPage({
  authMode,
  githubStars,
  listings,
}: {
  readonly authMode: AuthMode;
  readonly githubStars: number | null;
  readonly listings: readonly PublicDirectoryListing[];
}) {
  return (
    <MarketingShell
      authMode={authMode}
      callbackPath="/business"
      githubStars={githubStars}
    >
      {() => <BusinessPageContent listings={listings} />}
    </MarketingShell>
  );
}

function BusinessPageContent({
  listings,
}: {
  readonly listings: readonly PublicDirectoryListing[];
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => filterDirectoryListings(listings, query),
    [listings, query],
  );
  const showResults = query.trim().length > 0;

  return (
    <>
      <section className="pt-28 pb-16 sm:pt-32 sm:pb-20">
        <MarketingContainer>
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h1 className={marketingType.display}>Pearl, suggest my business.</h1>
            <p className={`mt-5 max-w-xl ${marketingType.body}`}>
              Pearl helps people find local businesses and creatives.{" "}
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">
                Make yours
              </span>{" "}
              one of them.
            </p>

            <div className="relative mt-8 w-full max-w-lg">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Search the directory"
                className="h-12 rounded-full border-border bg-card pr-4 pl-10 text-base shadow-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your business"
                value={query}
              />
              {showResults ? (
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg">
                  {matches.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      No match yet.{" "}
                      <a
                        className="font-medium text-foreground underline underline-offset-4"
                        href="#join"
                      >
                        Join the directory
                      </a>
                      .
                    </p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {matches.slice(0, 8).map((row) => (
                        <li
                          className="border-b border-border px-4 py-3 last:border-b-0"
                          key={row.id}
                        >
                          <p className="text-sm font-medium text-foreground">
                            {row.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {DIRECTORY_CATEGORY_LABELS[
                              row.category as DirectoryCategory
                            ] ?? row.category}
                            {" · "}
                            {row.city}
                            {row.region ? `, ${row.region}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <Button asChild className="mt-6 h-11 rounded-full px-6" size="lg">
              <a href="#join">Join the directory</a>
            </Button>
            <p className={`mt-3 ${marketingType.caption}`}>
              Free to join. Real requests. Takes a few minutes.
            </p>
          </div>
        </MarketingContainer>
      </section>

      <section className="border-t border-border py-16 sm:py-20" id="why">
        <MarketingContainer>
          <h2 className={`text-center ${marketingType.sectionTitle}`}>
            Why partner with Pearl
          </h2>
          <ul className="mx-auto mt-12 grid max-w-5xl gap-8 sm:grid-cols-3">
            {WHY_JOIN.map((item) => (
              <li key={item.title}>
                <h3 className="text-lg font-medium tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className={`mt-2 ${marketingType.body}`}>{item.body}</p>
              </li>
            ))}
          </ul>
        </MarketingContainer>
      </section>

      <section className="border-t border-border py-16 sm:py-20" id="how">
        <MarketingContainer>
          <p className={`text-center ${marketingType.caption}`}>How it works</p>
          <h2 className={`mt-2 text-center ${marketingType.sectionTitle}`}>
            You do your thing. Pearl makes the connection.
          </h2>
          <ol className="mx-auto mt-12 grid max-w-5xl gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item, index) => (
              <li key={item.title}>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className={`mt-2 ${marketingType.body}`}>{item.body}</p>
              </li>
            ))}
          </ol>
        </MarketingContainer>
      </section>

      <section className="border-t border-border py-16 sm:py-20" id="faq">
        <MarketingContainer>
          <div className="mx-auto max-w-2xl">
            <h2 className={`text-center ${marketingType.sectionTitle}`}>
              A few good questions
            </h2>
            <Accordion
              className="mt-10 rounded-xl border border-border bg-card px-4 sm:px-5"
              collapsible
              defaultValue={FAQS[0].question}
              type="single"
            >
              {FAQS.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger className="text-left text-base font-medium tracking-tight hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className={marketingType.body}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </MarketingContainer>
      </section>

      <section className="border-t border-border py-16 sm:py-24" id="join">
        <MarketingContainer>
          <div className="mx-auto max-w-xl text-center">
            <h2 className={marketingType.sectionTitle}>
              Good at what you do? Let Pearl find you.
            </h2>
            <p className={`mt-4 ${marketingType.body}`}>
              Tell us about your business. We’ll review and add you when it’s a
              fit.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-xl">
            <JoinDirectoryForm />
          </div>
        </MarketingContainer>
      </section>
    </>
  );
}

function JoinDirectoryForm() {
  const [category, setCategory] = useState<DirectoryCategory | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    if (!category) {
      setError("Pick a category.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/directory/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          category,
          city: String(data.get("city") ?? ""),
          region: String(data.get("region") ?? ""),
          country: String(data.get("country") ?? "US"),
          description: String(data.get("description") ?? ""),
          website: String(data.get("website") ?? ""),
          instagram: String(data.get("instagram") ?? ""),
          contactEmail: String(data.get("contactEmail") ?? ""),
          contactPhone: String(data.get("contactPhone") ?? ""),
          companyWebsite: String(data.get("companyWebsite") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Could not save your listing.");
        return;
      }
      setDone(true);
      form.reset();
      setCategory("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-lg font-medium tracking-tight text-foreground">
          Thanks — you’re in the queue.
        </p>
        <p className={`mt-2 ${marketingType.body}`}>
          We’ll review your listing and email or call if we need anything else.
        </p>
        <Button
          className="mt-6 rounded-full"
          onClick={() => setDone(false)}
          type="button"
          variant="outline"
        >
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <form
      className="relative space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
      onSubmit={onSubmit}
    >
      {/* Honeypot */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] opacity-0">
        <label>
          Company website
          <input autoComplete="off" name="companyWebsite" tabIndex={-1} />
        </label>
      </div>

      <div>
        <label className={fieldLabelClass} htmlFor="directory-name">
          Business or creative name
        </label>
        <Input
          className="rounded-xl"
          id="directory-name"
          name="name"
          required
          placeholder="e.g. Mission Cut Club"
        />
      </div>

      <div>
        <label className={fieldLabelClass} htmlFor="directory-category">
          Category
        </label>
        <select
          className={cn(
            "flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
          id="directory-category"
          onChange={(event) =>
            setCategory(event.target.value as DirectoryCategory | "")
          }
          required
          value={category}
        >
          <option disabled value="">
            Select one
          </option>
          {DIRECTORY_CATEGORIES.map((id) => (
            <option key={id} value={id}>
              {DIRECTORY_CATEGORY_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={fieldLabelClass} htmlFor="directory-city">
            City
          </label>
          <Input
            className="rounded-xl"
            id="directory-city"
            name="city"
            placeholder="San Francisco"
            required
          />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="directory-region">
            Region / state
          </label>
          <Input
            className="rounded-xl"
            id="directory-region"
            name="region"
            placeholder="CA"
          />
        </div>
      </div>

      <div>
        <label className={fieldLabelClass} htmlFor="directory-description">
          What you do
        </label>
        <Textarea
          className="min-h-24 rounded-xl"
          id="directory-description"
          name="description"
          placeholder="Haircuts and color in the Mission. Walk-ins welcome weekends."
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={fieldLabelClass} htmlFor="directory-website">
            Website
          </label>
          <Input
            className="rounded-xl"
            id="directory-website"
            name="website"
            placeholder="https://"
            type="url"
          />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="directory-instagram">
            Instagram
          </label>
          <Input
            className="rounded-xl"
            id="directory-instagram"
            name="instagram"
            placeholder="@studio"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={fieldLabelClass} htmlFor="directory-email">
            Contact email
          </label>
          <Input
            className="rounded-xl"
            id="directory-email"
            name="contactEmail"
            placeholder="hello@example.com"
            type="email"
          />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="directory-phone">
            Contact phone
          </label>
          <Input
            className="rounded-xl"
            id="directory-phone"
            name="contactPhone"
            placeholder="+1…"
            type="tel"
          />
        </div>
      </div>
      <p className={marketingType.caption}>
        Share at least an email or a phone. Not shown on this page.
      </p>

      <input name="country" type="hidden" value="US" />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        className="h-11 w-full rounded-full"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Submitting…" : "Join the directory"}
      </Button>
    </form>
  );
}
