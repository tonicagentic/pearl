import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CoinsIcon,
  GaugeIcon,
  Loader2Icon,
} from "lucide-react";

import { getUserUsageRows } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import {
  aggregateUsage,
  formatTokens,
  formatUsd,
  type UsageBreakdownEntry,
} from "@/lib/usage/usage";

export const metadata: Metadata = {
  title: "Usage",
};

/**
 * Static shell: with cacheComponents, every uncached read (headers via auth,
 * database queries) must live inside a Suspense boundary so the route can
 * prerender its frame — same pattern as the shell's hidden ResolvedChatBootstrap.
 */
export default function SettingsPage() {
  return (
    <SettingsPageFrame>
      <Suspense fallback={<UsageFallback />}>
        <ResolvedUsage />
      </Suspense>
    </SettingsPageFrame>
  );
}

async function ResolvedUsage() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <SignedOutCard
        message={
          setupStatus.storageMode === "database"
            ? "Sign in to see your usage."
            : "Usage tracking needs database persistence."
        }
      />
    );
  }

  const rows = await getUserUsageRows(viewer.id);

  const summary = aggregateUsage(rows);

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Model usage across your chats, from the per-call usage eve reports
          on every completed model call.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<CoinsIcon className="size-3.5" />}
          label="Cost"
          value={formatUsd(summary.totals.costUsd)}
          hint={summary.totals.costUsd === null ? "no cost reported" : undefined}
        />
        <StatTile
          icon={<ArrowDownToLineIcon className="size-3.5" />}
          label="Input"
          value={formatTokens(summary.totals.inputTokens)}
          hint={`${formatTokens(summary.totals.cacheReadTokens)} from cache`}
        />
        <StatTile
          icon={<ArrowUpFromLineIcon className="size-3.5" />}
          label="Output"
          value={formatTokens(summary.totals.outputTokens)}
        />
        <StatTile
          icon={<GaugeIcon className="size-3.5" />}
          label="Turns"
          value={String(summary.turns)}
          hint={`${String(summary.totals.modelCalls)} model calls`}
        />
      </div>

      <UsageTable
        title="By day"
        rows={summary.byDay.map((entry) => ({ ...entry, label: entry.day }))}
        emptyMessage="No usage yet."
      />

      <UsageTable title="By model" rows={summary.byModel} emptyMessage="No usage yet." />

      <p className="text-xs text-muted-foreground">
        Counts reflect the chat event log on the server. Chats stored only in
        your browser are not included, turns whose tab closed mid-stream may
        be incomplete, and tokens eve uses for internal compaction are not
        reported per call.
      </p>
    </>
  );
}

function UsageFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading your usage…
    </div>
  );
}

/**
 * The (chat) shell renders `main` as a non-scrolling flex column with the
 * sidebar/menu controls absolutely positioned over the top edge, so route
 * content must fill `main` (flex min-h-0 flex-1) and provide its own scroll
 * container plus top clearance for those controls — same contract the chat
 * surface follows.
 */
function SettingsPageFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

type UsageRowView = UsageBreakdownEntry;

function UsageTable({
  title,
  rows,
  emptyMessage,
}: {
  readonly title: string;
  readonly rows: readonly UsageRowView[];
  readonly emptyMessage: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Calls</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Cached</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <td className="max-w-56 truncate px-3 py-2">{row.label}</td>
                  <NumCell value={row.modelCalls} />
                  <NumCell value={formatTokens(row.inputTokens)} />
                  <NumCell value={formatTokens(row.outputTokens)} />
                  <NumCell value={formatTokens(row.cacheReadTokens)} />
                  <NumCell value={formatUsd(row.costUsd)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NumCell({ value }: { readonly value: string | number }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
      {value}
    </td>
  );
}

function SignedOutCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Usage</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
