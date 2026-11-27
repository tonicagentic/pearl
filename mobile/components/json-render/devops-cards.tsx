import {
  checkStateTone,
  computeStateTone,
  deployStateTone,
  formatPrRef,
  prStateTone,
  truncateQuery,
  type StatusTone,
} from "../../../lib/json-render/devops";
import { isPickOption } from "../../../lib/json-render/pick";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { View } from "react-native";

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-muted",
  positive: "bg-emerald-500/15",
  negative: "bg-red-500/15",
  warning: "bg-amber-500/15",
};

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString) : [];
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === "object" && !Array.isArray(item),
  );
}

function Chip({
  label,
  tone = "neutral",
}: {
  readonly label: string;
  readonly tone?: StatusTone;
}) {
  return (
    <View className={cn("rounded-full px-2 py-0.5", toneClass[tone])}>
      <Text variant="caption" className="capitalize">
        {label}
      </Text>
    </View>
  );
}

function RowCard({
  emphasized,
  children,
}: {
  readonly emphasized?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <View
      className={cn(
        "flex-col gap-0.5 rounded-lg border px-2.5 py-2",
        emphasized ? "border-foreground/30 bg-muted/50" : "border-border/50",
      )}
    >
      {children}
    </View>
  );
}

function PickCard({
  pick,
  reason,
  timeframe,
  options,
}: {
  readonly pick: string;
  readonly reason: string | null;
  readonly timeframe: string | null;
  readonly options: readonly {
    readonly name: string;
    readonly detail: string | null;
    readonly meta: string | null;
  }[];
}) {
  return (
    <View className="flex-col gap-3">
      <View className="flex-col gap-0.5">
        {timeframe ? <Text variant="caption">{timeframe}</Text> : null}
        <Text variant="body" weight="medium">
          Go to {pick}
        </Text>
        {reason ? (
          <Text variant="secondary" className="leading-relaxed">
            {reason}
          </Text>
        ) : null}
      </View>
      <View className="flex-col gap-2">
        {options.map((option) => {
          const selected = isPickOption(option.name, pick);
          return (
            <RowCard key={option.name} emphasized={selected}>
              <View className="flex-row items-baseline justify-between gap-2">
                <Text
                  variant="secondary"
                  weight={selected ? "semibold" : "medium"}
                >
                  {option.name}
                  {selected ? " · pick" : ""}
                </Text>
                {option.meta ? (
                  <Text variant="caption">{option.meta}</Text>
                ) : null}
              </View>
              {option.detail ? (
                <Text variant="caption" className="leading-relaxed">
                  {option.detail}
                </Text>
              ) : null}
            </RowCard>
          );
        })}
      </View>
    </View>
  );
}

function pickFromElement(element: { props: Record<string, unknown> }) {
  return {
    pick: asString(element.props.pick),
    reason:
      element.props.reason == null ? null : asString(element.props.reason),
    timeframe:
      element.props.timeframe == null
        ? null
        : asString(element.props.timeframe),
    options: asObjectArray(element.props.options).map((option) => ({
      name: asString(option.name),
      detail: option.detail == null ? null : asString(option.detail),
      meta: option.meta == null ? null : asString(option.meta),
    })),
  };
}

/** Mobile json-render components for Vercel / GitHub / Neon answer cards. */
export const devopsMobileCards = {
  VercelProject: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const latest = asObjectArray(
      element.props.latestDeploy ? [element.props.latestDeploy] : [],
    )[0];
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {asString(element.props.name)}
          </Text>
          <Text variant="caption">
            {[element.props.team, element.props.framework]
              .filter((value) => value != null && asString(value))
              .map(asString)
              .join(" · ")}
          </Text>
        </View>
        {element.props.productionUrl ? (
          <Text variant="secondary">
            {asString(element.props.productionUrl)}
          </Text>
        ) : null}
        {latest ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip
              label={asString(latest.state)}
              tone={deployStateTone(asString(latest.state))}
            />
            <Text variant="caption">
              {[latest.env, latest.createdAt]
                .filter((value) => value != null && asString(value))
                .map(asString)
                .join(" · ")}
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
  VercelProjectList: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const items = asObjectArray(element.props.items);
    return (
      <View className="flex-col gap-3">
        {element.props.team ? (
          <Text variant="body" weight="medium">
            {asString(element.props.team)}
          </Text>
        ) : null}
        <View className="flex-col gap-2">
          {items.map((item, index) => (
            <RowCard key={`${asString(item.name)}-${index}`}>
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="secondary" weight="medium">
                  {asString(item.name)}
                </Text>
                {item.latestState != null && asString(item.latestState) ? (
                  <Chip
                    label={asString(item.latestState)}
                    tone={deployStateTone(asString(item.latestState))}
                  />
                ) : null}
              </View>
              <Text variant="caption">
                {[item.framework, item.productionUrl]
                  .filter((value) => value != null && asString(value))
                  .map(asString)
                  .join(" · ")}
              </Text>
            </RowCard>
          ))}
        </View>
      </View>
    );
  },
  DeploymentStatus: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => (
    <View className="flex-col gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="body" weight="medium">
          {asString(element.props.project)}
        </Text>
        <Chip
          label={asString(element.props.state)}
          tone={deployStateTone(asString(element.props.state))}
        />
      </View>
      <Text variant="caption">
        {[
          element.props.environment,
          element.props.branch,
          element.props.commit,
          element.props.duration,
          element.props.createdAt,
        ]
          .filter((value) => value != null && asString(value))
          .map(asString)
          .join(" · ")}
      </Text>
      {element.props.url ? (
        <Text variant="secondary">{asString(element.props.url)}</Text>
      ) : null}
    </View>
  ),
  DeploymentList: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const items = asObjectArray(element.props.items);
    return (
      <View className="flex-col gap-3">
        {element.props.project ? (
          <Text variant="body" weight="medium">
            {asString(element.props.project)}
          </Text>
        ) : null}
        <View className="flex-col gap-2">
          {items.map((item, index) => (
            <RowCard key={`${asString(item.createdAt)}-${index}`}>
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="secondary" weight="medium" className="capitalize">
                  {asString(item.environment)}
                </Text>
                <Chip
                  label={asString(item.state)}
                  tone={deployStateTone(asString(item.state))}
                />
              </View>
              <Text variant="caption">
                {[item.branch, item.commit, item.createdAt]
                  .filter((value) => value != null && asString(value))
                  .map(asString)
                  .join(" · ")}
              </Text>
            </RowCard>
          ))}
        </View>
      </View>
    );
  },
  PullRequest: ({ element }: { element: { props: Record<string, unknown> } }) => (
    <View className="flex-col gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip
          label={asString(element.props.state)}
          tone={prStateTone(asString(element.props.state))}
        />
        {element.props.checks ? (
          <Chip
            label={asString(element.props.checks)}
            tone={checkStateTone(asString(element.props.checks))}
          />
        ) : null}
      </View>
      <Text variant="body" weight="medium">
        {formatPrRef(asNumber(element.props.number))}{" "}
        {asString(element.props.title)}
      </Text>
      <Text variant="caption">
        {[element.props.repo, element.props.branch, element.props.author]
          .filter((value) => value != null && asString(value))
          .map(asString)
          .join(" · ")}
      </Text>
    </View>
  ),
  PullRequestList: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const items = asObjectArray(element.props.items);
    return (
      <View className="flex-col gap-3">
        {element.props.repo ? (
          <Text variant="body" weight="medium">
            {asString(element.props.repo)}
          </Text>
        ) : null}
        <View className="flex-col gap-2">
          {items.map((item) => (
            <RowCard key={asNumber(item.number)}>
              <View className="flex-row flex-wrap items-center gap-2">
                <Chip
                  label={asString(item.state)}
                  tone={prStateTone(asString(item.state))}
                />
                {item.checks ? (
                  <Chip
                    label={asString(item.checks)}
                    tone={checkStateTone(asString(item.checks))}
                  />
                ) : null}
              </View>
              <Text variant="secondary" weight="medium">
                {formatPrRef(asNumber(item.number))} {asString(item.title)}
              </Text>
              <Text variant="caption">
                {[item.branch, item.author]
                  .filter((value) => value != null && asString(value))
                  .map(asString)
                  .join(" · ")}
              </Text>
            </RowCard>
          ))}
        </View>
      </View>
    );
  },
  Issue: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const labels = asStringArray(element.props.labels);
    const state = asString(element.props.state);
    return (
      <View className="flex-col gap-2">
        <Chip label={state} tone={state === "open" ? "warning" : "neutral"} />
        <Text variant="body" weight="medium">
          {formatPrRef(asNumber(element.props.number))}{" "}
          {asString(element.props.title)}
        </Text>
        <Text variant="caption">
          {[element.props.repo, element.props.author]
            .filter((value) => value != null && asString(value))
            .map(asString)
            .join(" · ")}
        </Text>
        {labels.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {labels.map((label) => (
              <Chip key={label} label={label} />
            ))}
          </View>
        ) : null}
      </View>
    );
  },
  IssueList: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const items = asObjectArray(element.props.items);
    return (
      <View className="flex-col gap-3">
        {element.props.repo ? (
          <Text variant="body" weight="medium">
            {asString(element.props.repo)}
          </Text>
        ) : null}
        <View className="flex-col gap-2">
          {items.map((item) => {
            const state = asString(item.state);
            return (
              <RowCard key={asNumber(item.number)}>
                <View className="flex-row items-center gap-2">
                  <Chip
                    label={state}
                    tone={state === "open" ? "warning" : "neutral"}
                  />
                  <Text variant="secondary" weight="medium" className="flex-1">
                    {formatPrRef(asNumber(item.number))} {asString(item.title)}
                  </Text>
                </View>
                {item.author ? (
                  <Text variant="caption">{asString(item.author)}</Text>
                ) : null}
              </RowCard>
            );
          })}
        </View>
      </View>
    );
  },
  NeonProject: ({ element }: { element: { props: Record<string, unknown> } }) => (
    <View className="flex-col gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="body" weight="medium">
          {asString(element.props.name)}
        </Text>
        {element.props.compute ? (
          <Chip
            label={asString(element.props.compute)}
            tone={computeStateTone(asString(element.props.compute))}
          />
        ) : null}
      </View>
      <Text variant="caption">
        {[
          element.props.region,
          element.props.defaultBranch,
          element.props.branchesOpen,
        ]
          .filter((value) => value != null && asString(value))
          .map(asString)
          .join(" · ")}
      </Text>
    </View>
  ),
  NeonBranch: ({ element }: { element: { props: Record<string, unknown> } }) => (
    <View className="flex-col gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="body" weight="medium">
          {asString(element.props.name)}
        </Text>
        {element.props.primary ? (
          <Chip label="primary" tone="positive" />
        ) : null}
        {element.props.compute ? (
          <Chip
            label={asString(element.props.compute)}
            tone={computeStateTone(asString(element.props.compute))}
          />
        ) : null}
      </View>
      <Text variant="caption">
        {[
          element.props.project,
          element.props.parent
            ? `from ${asString(element.props.parent)}`
            : null,
        ]
          .filter((value) => value != null && asString(value))
          .map(asString)
          .join(" · ")}
      </Text>
      {element.props.endpointHost ? (
        <Text variant="caption" className="font-mono">
          {asString(element.props.endpointHost)}
        </Text>
      ) : null}
    </View>
  ),
  SchemaOverview: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const tables = asObjectArray(element.props.tables);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {element.props.database
              ? asString(element.props.database)
              : "Schema"}
          </Text>
          {element.props.tableCount != null ? (
            <Text variant="caption">
              {asNumber(element.props.tableCount)} tables
            </Text>
          ) : null}
        </View>
        <View className="flex-col">
          {tables.map((table, index) => (
            <View
              key={asString(table.name)}
              className={cn(
                "flex-row items-baseline justify-between gap-3 py-1.5",
                index > 0 && "border-border/60 border-t",
              )}
            >
              <Text variant="caption" className="font-mono">
                {asString(table.name)}
              </Text>
              <Text variant="caption" className="text-right">
                {[table.rows, table.detail]
                  .filter((value) => value != null && asString(value))
                  .map(asString)
                  .join(" · ")}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  },
  ShipStatus: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const pr = asObjectArray(
      element.props.pr ? [element.props.pr] : [],
    )[0];
    return (
      <View className="flex-col gap-2">
        <Text variant="body" weight="medium">
          {asString(element.props.repo)}
        </Text>
        {element.props.branch ? (
          <Text variant="caption">{asString(element.props.branch)}</Text>
        ) : null}
        {pr ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="secondary" weight="medium">
              {formatPrRef(asNumber(pr.number))}
              {pr.title ? ` ${asString(pr.title)}` : ""}
            </Text>
            {pr.checks ? (
              <Chip
                label={asString(pr.checks)}
                tone={checkStateTone(asString(pr.checks))}
              />
            ) : null}
          </View>
        ) : null}
        {element.props.deployState ? (
          <Chip
            label={asString(element.props.deployState)}
            tone={deployStateTone(asString(element.props.deployState))}
          />
        ) : null}
        {element.props.previewUrl ? (
          <Text variant="secondary">
            {asString(element.props.previewUrl)}
          </Text>
        ) : null}
      </View>
    );
  },
  EnvVarList: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const names = asStringArray(element.props.names);
    return (
      <View className="flex-col gap-3">
        <View className="flex-col gap-0.5">
          <Text variant="body" weight="medium">
            {element.props.project
              ? asString(element.props.project)
              : "Environment variables"}
          </Text>
          <Text variant="caption">
            {[element.props.environment, "names only"]
              .filter((value) => value != null && asString(value))
              .map(asString)
              .join(" · ")}
          </Text>
        </View>
        <View className="flex-col gap-1">
          {names.map((name) => (
            <Text key={name} variant="caption" className="font-mono">
              {name}
            </Text>
          ))}
        </View>
      </View>
    );
  },
  DomainList: ({ element }: { element: { props: Record<string, unknown> } }) => {
    const domains = asObjectArray(element.props.domains);
    return (
      <View className="flex-col gap-3">
        {element.props.project ? (
          <Text variant="body" weight="medium">
            {asString(element.props.project)}
          </Text>
        ) : null}
        <View className="flex-col gap-2">
          {domains.map((domain) => (
            <RowCard key={asString(domain.name)}>
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="secondary" weight="medium">
                  {asString(domain.name)}
                </Text>
                {domain.verified != null ? (
                  <Chip
                    label={domain.verified ? "verified" : "unverified"}
                    tone={domain.verified ? "positive" : "warning"}
                  />
                ) : null}
              </View>
              {domain.environment ? (
                <Text variant="caption">
                  {asString(domain.environment)}
                </Text>
              ) : null}
            </RowCard>
          ))}
        </View>
      </View>
    );
  },
  SlowQueryList: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => {
    const items = asObjectArray(element.props.items);
    return (
      <View className="flex-col gap-3">
        {element.props.project ? (
          <Text variant="body" weight="medium">
            {asString(element.props.project)}
          </Text>
        ) : null}
        <View className="flex-col gap-2">
          {items.map((item, index) => (
            <RowCard key={`${index}-${asString(item.duration)}`}>
              <Text variant="caption" className="font-mono leading-relaxed">
                {truncateQuery(asString(item.query))}
              </Text>
              <Text variant="caption">
                {[item.duration, item.calls, item.note]
                  .filter((value) => value != null && asString(value))
                  .map(asString)
                  .join(" · ")}
              </Text>
            </RowCard>
          ))}
        </View>
      </View>
    );
  },
  RepoPick: ({ element }: { element: { props: Record<string, unknown> } }) => (
    <PickCard {...pickFromElement(element)} />
  ),
  ProjectPick: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => <PickCard {...pickFromElement(element)} />,
  NeonBranchPick: ({
    element,
  }: {
    element: { props: Record<string, unknown> };
  }) => <PickCard {...pickFromElement(element)} />,
} as const;
