"use client";

import type { Spec } from "@json-render/core";
import Link from "next/link";
import type { ReactNode } from "react";
import { PearlIcon } from "@/components/icons";
import { MarketingJsonCard } from "@/components/marketing/marketing-json-card";
import { MarketingContainer } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { cn } from "@/lib/utils";

const everydaySpec: Spec = {
  root: "card",
  elements: {
    card: {
      type: "Card",
      props: { title: null, description: null },
      children: ["table"],
    },
    table: {
      type: "Table",
      props: {
        columns: ["Company", "Round", "Lead"],
        rows: [
          ["OpenAI", "$40B", "SoftBank"],
          ["Anthropic", "$13B", "Spark"],
          ["xAI", "$10B", "Valor"],
        ],
      },
      children: [],
    },
  },
};

function BandVisual({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border",
        "bg-[linear-gradient(160deg,var(--muted)_0%,oklch(0.96_0.01_80)_45%,oklch(0.94_0.02_50)_100%)]",
        "p-5 sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EverydayVisual() {
  return (
    <BandVisual>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl bg-foreground px-3.5 py-2.5 text-sm leading-5 text-background">
            What are the biggest AI investments this year?
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
            <PearlIcon className="size-3.5 text-foreground" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <p className="rounded-2xl bg-card px-3.5 py-2.5 text-sm leading-5 text-foreground shadow-sm">
              Ranked by round size — here are the ones that moved the needle.
            </p>
            <MarketingJsonCard spec={everydaySpec} />
          </div>
        </div>
      </div>
    </BandVisual>
  );
}

function HandledVisual() {
  const windows = [
    {
      title: "Research",
      body: "Compiling sources on SF neighborhood foot traffic…",
    },
    {
      title: "Sandbox",
      body: "Building portfolio site · index.html",
    },
    {
      title: "Browser",
      body: "Checking in-network MRI openings this week…",
    },
  ] as const;

  return (
    <BandVisual>
      <div className="relative mx-auto flex min-h-[280px] w-full max-w-md items-center justify-center">
        {windows.map((window, index) => (
          <div
            className={cn(
              "absolute w-[88%] overflow-hidden rounded-xl border border-border bg-card shadow-sm",
              index === 0 && "z-30 translate-y-0",
              index === 1 && "z-20 translate-x-3 translate-y-6 opacity-95",
              index === 2 && "z-10 -translate-x-2 translate-y-12 opacity-80",
            )}
            key={window.title}
            style={{ top: `${index * 18}%` }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="size-2 rounded-full bg-muted-foreground/25" />
              <span className="ml-1 text-[11px] text-muted-foreground">
                {window.title}
              </span>
            </div>
            <p className="px-3 py-3 text-xs leading-relaxed text-foreground">
              {window.body}
            </p>
          </div>
        ))}
      </div>
    </BandVisual>
  );
}

function TapListVisual() {
  const actions = [
    { verb: "Archive", rest: "61 newsletter threads in Gmail" },
    { verb: "Draft", rest: "reply to Maya on the hiring thread" },
    { verb: "Book", rest: "UCSF Imaging — Thu 2:40p" },
    { verb: "Send", rest: "Mercury outreach (waiting on you)" },
    { verb: "Ship", rest: "portfolio gallery behind password" },
  ] as const;

  return (
    <BandVisual>
      <ul className="mx-auto flex w-full max-w-sm flex-col gap-2.5">
        {actions.map((action) => (
          <li
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm"
            key={action.verb + action.rest}
          >
            <span className="inline-flex shrink-0 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground">
              {action.verb}
            </span>
            <span className="min-w-0 text-sm leading-snug text-muted-foreground">
              {action.rest}
            </span>
          </li>
        ))}
      </ul>
    </BandVisual>
  );
}

function CapabilityBand({
  title,
  body,
  visual,
  copyFirst,
}: {
  readonly title: string;
  readonly body: ReactNode;
  readonly visual: ReactNode;
  readonly copyFirst: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
      <div className={cn(copyFirst ? "lg:order-1" : "lg:order-2")}>
        <h2 className={marketingType.sectionTitle}>{title}</h2>
        <div className={`mt-4 space-y-4 ${marketingType.body}`}>{body}</div>
      </div>
      <div className={cn(copyFirst ? "lg:order-2" : "lg:order-1")}>
        {visual}
      </div>
    </div>
  );
}

export function CapabilityBands() {
  return (
    <section className="py-16 sm:py-24" id="capabilities">
      <MarketingContainer className="flex flex-col gap-20 sm:gap-28">
        <CapabilityBand
          body={
            <>
              <p>
                Chat with Pearl in a single thread for whatever you need —
                research, mail, planning. Persistent memory so answers fit how
                you work.
              </p>
              <p>
                Bigger undertakings stay organized in Projects. On web and iOS.
              </p>
            </>
          }
          copyFirst
          title="Make everyday easier"
          visual={<EverydayVisual />}
        />

        <CapabilityBand
          body={
            <>
              <p>
                Pearl can take longer jobs — research, build a site, work through
                tools in a secure sandbox — and bring results back under your
                direction. Sensitive steps wait for your approval.
              </p>
              <p>
                For recurring or specialized work, spin up{" "}
                <Link
                  className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
                  href="/marketplace"
                >
                  custom agents
                </Link>{" "}
                Pearl can delegate to.
              </p>
            </>
          }
          copyFirst={false}
          title="Consider it handled"
          visual={<HandledVisual />}
        />

        <CapabilityBand
          body={
            <p>
              Pearl surfaces next actions from what it knows you have on your
              plate. Approve or kick off from chat; Pearl runs the work from
              start to finish when you say go.
            </p>
          }
          copyFirst={false}
          title="Tap it off your list"
          visual={<TapListVisual />}
        />
      </MarketingContainer>
    </section>
  );
}
