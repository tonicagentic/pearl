import type {
  AgentMarkBrows,
  AgentMarkGaze,
  AgentMarkShape,
  AgentMarkTalk,
} from "@/lib/custom-agents/mark";
import type { AgentIntegrationId } from "@/lib/custom-agents/integrations";

export type AgentTemplateMemoryView = {
  readonly text: string;
};

export type AgentTemplateSkillView = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
};

export type AgentTemplateRoutineView = {
  readonly name: string;
  readonly cron: string;
  readonly timezone: string;
  readonly prompt: string;
};

export type AgentTemplateIntegrationView = {
  readonly connectionId: AgentIntegrationId;
};

/** Public directory card (no full skill markdown bodies in list payloads). */
export type AgentTemplateSummary = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly featured: boolean;
  readonly sortOrder: number;
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows: AgentMarkBrows;
  readonly markGaze: AgentMarkGaze;
  readonly memoryCount: number;
  readonly skillCount: number;
  readonly routineCount: number;
  readonly integrationIds: readonly AgentIntegrationId[];
  /** Present when this user already added the template. */
  readonly addedAgentId: string | null;
  readonly addedChatId: string | null;
};

export type AgentTemplateDetail = AgentTemplateSummary & {
  readonly instructions: string;
  readonly memories: readonly AgentTemplateMemoryView[];
  readonly skills: readonly AgentTemplateSkillView[];
  readonly routines: readonly AgentTemplateRoutineView[];
  readonly integrations: readonly AgentTemplateIntegrationView[];
};

export type CustomAgentMemoryView = {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CustomAgentSkillView = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly markdown: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CustomAgentRoutineView = {
  readonly id: string;
  readonly name: string;
  readonly cron: string;
  readonly timezone: string;
  readonly prompt: string;
  readonly enabled: boolean;
  readonly lastRunAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CustomAgentIntegrationView = {
  readonly id: string;
  readonly connectionId: AgentIntegrationId;
  readonly createdAt: string;
};

export type CustomAgentConfigBundle = {
  readonly memories: readonly CustomAgentMemoryView[];
  readonly skills: readonly CustomAgentSkillView[];
  readonly routines: readonly CustomAgentRoutineView[];
  readonly integrations: readonly CustomAgentIntegrationView[];
};
