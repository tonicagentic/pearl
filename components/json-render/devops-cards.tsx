"use client";

import {
  checkStateTone,
  computeStateTone,
  deployStateTone,
  formatPrRef,
  prStateTone,
  truncateQuery,
  type StatusTone,
} from "@/lib/json-render/devops";
import { isPickOption } from "@/lib/json-render/pick";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  negative: "bg-red-500/15 text-red-700 dark:text-red-300",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
};

function Chip({
  label,
  tone = "neutral",
}: {
  readonly label: string;
  readonly tone?: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        toneClass[tone],
      )}
    >
      {label}
    </span>
  );
}

function MetaLine({ children }: { readonly children: ReactNode }) {
  return <div className="text-muted-foreground text-[12px]">{children}</div>;
}

function RowCard({
  emphasized,
  children,
}: {
  readonly emphasized?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border px-2.5 py-2",
        emphasized ? "border-foreground/30 bg-muted/50" : "border-border/50",
      )}
    >
      {children}
    </div>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {timeframe ? <MetaLine>{timeframe}</MetaLine> : null}
        <div className="text-foreground text-[15px] font-medium">Go to {pick}</div>
        {reason ? (
          <div className="text-muted-foreground text-[13.5px] leading-relaxed">
            {reason}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = isPickOption(option.name, pick);
          return (
            <RowCard key={option.name} emphasized={selected}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-[13.5px]",
                    selected
                      ? "text-foreground font-semibold"
                      : "text-foreground font-medium",
                  )}
                >
                  {option.name}
                  {selected ? " · pick" : ""}
                </span>
                {option.meta ? <MetaLine>{option.meta}</MetaLine> : null}
              </div>
              {option.detail ? (
                <div className="text-muted-foreground text-[12px] leading-relaxed">
                  {option.detail}
                </div>
              ) : null}
            </RowCard>
          );
        })}
      </div>
    </div>
  );
}

/** Web json-render components for Vercel / GitHub / Neon answer cards. */
export const devopsWebCards = {
  VercelProject: ({
    props,
  }: {
    props: {
      name: string;
      team: string | null;
      framework: string | null;
      productionUrl: string | null;
      latestDeploy: {
        state: string;
        env: string;
        url: string | null;
        createdAt: string | null;
      } | null;
    };
  }) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="text-foreground text-[15px] font-medium">{props.name}</div>
        <MetaLine>
          {[props.team, props.framework].filter(Boolean).join(" · ")}
        </MetaLine>
      </div>
      {props.productionUrl ? (
        <div className="text-foreground text-[13px]">{props.productionUrl}</div>
      ) : null}
      {props.latestDeploy ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            label={props.latestDeploy.state}
            tone={deployStateTone(props.latestDeploy.state)}
          />
          <MetaLine>
            {[props.latestDeploy.env, props.latestDeploy.createdAt]
              .filter(Boolean)
              .join(" · ")}
          </MetaLine>
        </div>
      ) : null}
    </div>
  ),
  VercelProjectList: ({
    props,
  }: {
    props: {
      team: string | null;
      items: readonly {
        name: string;
        framework: string | null;
        productionUrl: string | null;
        latestState: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      {props.team ? (
        <div className="text-foreground text-[15px] font-medium">{props.team}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.items.map((item) => (
          <RowCard key={item.name}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground text-[13.5px] font-medium">
                {item.name}
              </span>
              {item.latestState ? (
                <Chip
                  label={item.latestState}
                  tone={deployStateTone(item.latestState)}
                />
              ) : null}
            </div>
            <MetaLine>
              {[item.framework, item.productionUrl].filter(Boolean).join(" · ")}
            </MetaLine>
          </RowCard>
        ))}
      </div>
    </div>
  ),
  DeploymentStatus: ({
    props,
  }: {
    props: {
      project: string;
      state: string;
      environment: string;
      url: string | null;
      commit: string | null;
      branch: string | null;
      duration: string | null;
      createdAt: string | null;
    };
  }) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-foreground text-[15px] font-medium">{props.project}</div>
        <Chip label={props.state} tone={deployStateTone(props.state)} />
      </div>
      <MetaLine>
        {[props.environment, props.branch, props.commit, props.duration, props.createdAt]
          .filter(Boolean)
          .join(" · ")}
      </MetaLine>
      {props.url ? <div className="text-foreground text-[13px]">{props.url}</div> : null}
    </div>
  ),
  DeploymentList: ({
    props,
  }: {
    props: {
      project: string | null;
      items: readonly {
        state: string;
        environment: string;
        url: string | null;
        commit: string | null;
        branch: string | null;
        createdAt: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      {props.project ? (
        <div className="text-foreground text-[15px] font-medium">{props.project}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.items.map((item, index) => (
          <RowCard key={`${item.createdAt ?? index}-${item.commit ?? index}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground text-[13.5px] font-medium capitalize">
                {item.environment}
              </span>
              <Chip label={item.state} tone={deployStateTone(item.state)} />
            </div>
            <MetaLine>
              {[item.branch, item.commit, item.createdAt].filter(Boolean).join(" · ")}
            </MetaLine>
          </RowCard>
        ))}
      </div>
    </div>
  ),
  PullRequest: ({
    props,
  }: {
    props: {
      title: string;
      number: number;
      repo: string;
      state: string;
      checks: string | null;
      url: string | null;
      author: string | null;
      branch: string | null;
    };
  }) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Chip label={props.state} tone={prStateTone(props.state)} />
        {props.checks ? (
          <Chip label={props.checks} tone={checkStateTone(props.checks)} />
        ) : null}
      </div>
      <div className="text-foreground text-[15px] font-medium">
        {formatPrRef(props.number)} {props.title}
      </div>
      <MetaLine>
        {[props.repo, props.branch, props.author].filter(Boolean).join(" · ")}
      </MetaLine>
    </div>
  ),
  PullRequestList: ({
    props,
  }: {
    props: {
      repo: string | null;
      items: readonly {
        title: string;
        number: number;
        state: string;
        checks: string | null;
        author: string | null;
        branch: string | null;
        url: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      {props.repo ? (
        <div className="text-foreground text-[15px] font-medium">{props.repo}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.items.map((item) => (
          <RowCard key={item.number}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip label={item.state} tone={prStateTone(item.state)} />
              {item.checks ? (
                <Chip label={item.checks} tone={checkStateTone(item.checks)} />
              ) : null}
            </div>
            <div className="text-foreground text-[13.5px] font-medium">
              {formatPrRef(item.number)} {item.title}
            </div>
            <MetaLine>
              {[item.branch, item.author].filter(Boolean).join(" · ")}
            </MetaLine>
          </RowCard>
        ))}
      </div>
    </div>
  ),
  Issue: ({
    props,
  }: {
    props: {
      title: string;
      number: number;
      repo: string;
      state: string;
      url: string | null;
      author: string | null;
      labels: string[] | null;
    };
  }) => (
    <div className="flex flex-col gap-2">
      <Chip
        label={props.state}
        tone={props.state === "open" ? "warning" : "neutral"}
      />
      <div className="text-foreground text-[15px] font-medium">
        {formatPrRef(props.number)} {props.title}
      </div>
      <MetaLine>
        {[props.repo, props.author].filter(Boolean).join(" · ")}
      </MetaLine>
      {props.labels && props.labels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {props.labels.map((label) => (
            <Chip key={label} label={label} />
          ))}
        </div>
      ) : null}
    </div>
  ),
  IssueList: ({
    props,
  }: {
    props: {
      repo: string | null;
      items: readonly {
        title: string;
        number: number;
        state: string;
        author: string | null;
        labels: string[] | null;
        url: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      {props.repo ? (
        <div className="text-foreground text-[15px] font-medium">{props.repo}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.items.map((item) => (
          <RowCard key={item.number}>
            <div className="flex items-center gap-2">
              <Chip
                label={item.state}
                tone={item.state === "open" ? "warning" : "neutral"}
              />
              <span className="text-foreground text-[13.5px] font-medium">
                {formatPrRef(item.number)} {item.title}
              </span>
            </div>
            <MetaLine>{item.author ?? ""}</MetaLine>
          </RowCard>
        ))}
      </div>
    </div>
  ),
  NeonProject: ({
    props,
  }: {
    props: {
      name: string;
      region: string | null;
      branchesOpen: string | null;
      defaultBranch: string | null;
      compute: string | null;
    };
  }) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-foreground text-[15px] font-medium">{props.name}</div>
        {props.compute ? (
          <Chip label={props.compute} tone={computeStateTone(props.compute)} />
        ) : null}
      </div>
      <MetaLine>
        {[props.region, props.defaultBranch, props.branchesOpen]
          .filter(Boolean)
          .join(" · ")}
      </MetaLine>
    </div>
  ),
  NeonBranch: ({
    props,
  }: {
    props: {
      name: string;
      project: string | null;
      parent: string | null;
      primary: boolean | null;
      compute: string | null;
      endpointHost: string | null;
    };
  }) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-foreground text-[15px] font-medium">{props.name}</div>
        {props.primary ? <Chip label="primary" tone="positive" /> : null}
        {props.compute ? (
          <Chip label={props.compute} tone={computeStateTone(props.compute)} />
        ) : null}
      </div>
      <MetaLine>
        {[props.project, props.parent ? `from ${props.parent}` : null]
          .filter(Boolean)
          .join(" · ")}
      </MetaLine>
      {props.endpointHost ? (
        <div className="text-foreground font-mono text-[12px]">
          {props.endpointHost}
        </div>
      ) : null}
    </div>
  ),
  SchemaOverview: ({
    props,
  }: {
    props: {
      database: string | null;
      tableCount: number | null;
      tables: readonly {
        name: string;
        rows: string | null;
        detail: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="text-foreground text-[15px] font-medium">
          {props.database ?? "Schema"}
        </div>
        {props.tableCount != null ? (
          <MetaLine>{props.tableCount} tables</MetaLine>
        ) : null}
      </div>
      <div className="flex flex-col">
        {props.tables.map((table, index) => (
          <div
            key={table.name}
            className={cn(
              "flex items-baseline justify-between gap-3 py-1.5 text-[13px]",
              index > 0 && "border-border/60 border-t",
            )}
          >
            <span className="text-foreground font-mono text-[12px]">
              {table.name}
            </span>
            <span className="text-muted-foreground text-right">
              {[table.rows, table.detail].filter(Boolean).join(" · ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
  ShipStatus: ({
    props,
  }: {
    props: {
      repo: string;
      pr: {
        number: number;
        title: string | null;
        url: string | null;
        checks: string | null;
      } | null;
      previewUrl: string | null;
      deployState: string | null;
      branch: string | null;
    };
  }) => (
    <div className="flex flex-col gap-2">
      <div className="text-foreground text-[15px] font-medium">{props.repo}</div>
      <MetaLine>{props.branch ?? ""}</MetaLine>
      {props.pr ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-[13.5px] font-medium">
            {formatPrRef(props.pr.number)}
            {props.pr.title ? ` ${props.pr.title}` : ""}
          </span>
          {props.pr.checks ? (
            <Chip label={props.pr.checks} tone={checkStateTone(props.pr.checks)} />
          ) : null}
        </div>
      ) : null}
      {props.deployState ? (
        <Chip label={props.deployState} tone={deployStateTone(props.deployState)} />
      ) : null}
      {props.previewUrl ? (
        <div className="text-foreground text-[13px]">{props.previewUrl}</div>
      ) : null}
    </div>
  ),
  EnvVarList: ({
    props,
  }: {
    props: {
      project: string | null;
      environment: string | null;
      names: readonly string[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="text-foreground text-[15px] font-medium">
          {props.project ?? "Environment variables"}
        </div>
        <MetaLine>
          {[props.environment, "names only"].filter(Boolean).join(" · ")}
        </MetaLine>
      </div>
      <div className="flex flex-col gap-1">
        {props.names.map((name) => (
          <div
            key={name}
            className="text-foreground font-mono text-[12.5px] leading-relaxed"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  ),
  DomainList: ({
    props,
  }: {
    props: {
      project: string | null;
      domains: readonly {
        name: string;
        verified: boolean | null;
        environment: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      {props.project ? (
        <div className="text-foreground text-[15px] font-medium">{props.project}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.domains.map((domain) => (
          <RowCard key={domain.name}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground text-[13.5px] font-medium">
                {domain.name}
              </span>
              {domain.verified != null ? (
                <Chip
                  label={domain.verified ? "verified" : "unverified"}
                  tone={domain.verified ? "positive" : "warning"}
                />
              ) : null}
            </div>
            {domain.environment ? <MetaLine>{domain.environment}</MetaLine> : null}
          </RowCard>
        ))}
      </div>
    </div>
  ),
  SlowQueryList: ({
    props,
  }: {
    props: {
      project: string | null;
      items: readonly {
        query: string;
        duration: string | null;
        calls: string | null;
        note: string | null;
      }[];
    };
  }) => (
    <div className="flex flex-col gap-3">
      {props.project ? (
        <div className="text-foreground text-[15px] font-medium">{props.project}</div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.items.map((item, index) => (
          <RowCard key={`${index}-${item.duration ?? ""}`}>
            <div className="text-foreground font-mono text-[12px] leading-relaxed">
              {truncateQuery(item.query)}
            </div>
            <MetaLine>
              {[item.duration, item.calls, item.note].filter(Boolean).join(" · ")}
            </MetaLine>
          </RowCard>
        ))}
      </div>
    </div>
  ),
  RepoPick: ({
    props,
  }: {
    props: {
      pick: string;
      reason: string | null;
      timeframe: string | null;
      options: readonly {
        name: string;
        detail: string | null;
        meta: string | null;
      }[];
    };
  }) => <PickCard {...props} />,
  ProjectPick: ({
    props,
  }: {
    props: {
      pick: string;
      reason: string | null;
      timeframe: string | null;
      options: readonly {
        name: string;
        detail: string | null;
        meta: string | null;
      }[];
    };
  }) => <PickCard {...props} />,
  NeonBranchPick: ({
    props,
  }: {
    props: {
      pick: string;
      reason: string | null;
      timeframe: string | null;
      options: readonly {
        name: string;
        detail: string | null;
        meta: string | null;
      }[];
    };
  }) => <PickCard {...props} />,
} as const;
