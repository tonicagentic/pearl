import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddTemplateButton } from "@/components/custom-agents/add-template-button";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import {
  AGENT_INTEGRATION_LABELS,
  type AgentIntegrationId,
} from "@/lib/custom-agents/integrations";
import { getAgentTemplate } from "@/lib/custom-agents/templates";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const template = await getAgentTemplate(slug, null);
  return { title: template ? template.name : "Agent" };
}

export default async function AgentDirectoryDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  const template = await getAgentTemplate(
    slug,
    setup.storageMode === "database" && viewer ? viewer.id : null,
  );
  if (!template) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <Link
            className="text-sm text-muted-foreground hover:text-foreground"
            href="/agents"
          >
            ← Agents
          </Link>

          <header className="flex items-start gap-4">
            <AgentAccentMark
              accent={template.accent}
              markShape={template.markShape}
              markTalk={template.markTalk}
              markBrows={template.markBrows}
              markGaze={template.markGaze}
              size="lg"
              motion="idle"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{template.name}</h1>
              <p className="text-sm text-muted-foreground">by Pearl</p>
              <p className="mt-2 text-sm">{template.description}</p>
              <div className="mt-3">
                <AddTemplateButton
                  addedChatId={template.addedChatId}
                  slug={template.slug}
                  size="default"
                />
              </div>
            </div>
          </header>

          <section className="rounded-lg border bg-card p-3">
            <h2 className="text-sm font-medium">Standing instructions</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {template.instructions || "None"}
            </p>
          </section>

          <ConfigSection
            title="Memories"
            subtitle="Facts it already knows"
            empty="No starter facts."
            count={template.memories.length}
          >
            {template.memories.map((memory) => (
              <li key={memory.text} className="text-sm">
                {memory.text}
              </li>
            ))}
          </ConfigSection>

          <ConfigSection
            title="Skills"
            subtitle="Playbooks it can run"
            empty="No starter skills."
            count={template.skills.length}
          >
            {template.skills.map((skill) => (
              <li key={skill.slug} className="text-sm">
                <div className="font-medium">{skill.title}</div>
                <div className="text-muted-foreground">{skill.description}</div>
              </li>
            ))}
          </ConfigSection>

          <ConfigSection
            title="Routines"
            subtitle="Jobs that run on their own"
            empty="No starter routines."
            count={template.routines.length}
          >
            {template.routines.map((routine) => (
              <li key={routine.name} className="text-sm">
                <div className="font-medium">{routine.name}</div>
                <div className="text-xs text-muted-foreground">
                  {routine.cron} · {routine.timezone}
                </div>
                <div className="mt-1 text-muted-foreground">{routine.prompt}</div>
              </li>
            ))}
          </ConfigSection>

          <ConfigSection
            title="Integrations"
            subtitle="Apps it can use"
            empty="No apps required."
            count={template.integrations.length}
          >
            {template.integrations.map((row) => (
              <li key={row.connectionId} className="text-sm">
                {AGENT_INTEGRATION_LABELS[row.connectionId as AgentIntegrationId] ??
                  row.connectionId}
              </li>
            ))}
          </ConfigSection>
        </div>
      </div>
    </div>
  );
}

function ConfigSection({
  title,
  subtitle,
  empty,
  count,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly empty: string;
  readonly count: number;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {count > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">{children}</ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
