import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  formatScheduleSummary,
  normalizeTriggerConfig,
} from "@/lib/automations/schedule";
import type {
  AutomationDto,
  AutomationWriteInput,
} from "@/lib/automations/types";
import { isTriggerKind } from "@/lib/automations/types";
import { db } from "@/lib/db/client";
import {
  pearlAutomation,
  type PearlAutomation,
  type PearlAutomationTriggerConfig,
} from "@/lib/db/schema";

const MAX_NAME = 120;
const MAX_INSTRUCTIONS = 20_000;

export class AutomationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationError";
  }
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new AutomationError("An automation needs a name.");
  if (trimmed.length > MAX_NAME) {
    throw new AutomationError(
      `Names must be ${MAX_NAME} characters or fewer.`,
    );
  }
  return trimmed;
}

function requireInstructions(instructions: string): string {
  const trimmed = instructions.trim();
  if (!trimmed) {
    throw new AutomationError("Tell Pearl what this automation should do.");
  }
  if (trimmed.length > MAX_INSTRUCTIONS) {
    throw new AutomationError(
      `Instructions must be ${MAX_INSTRUCTIONS} characters or fewer.`,
    );
  }
  return trimmed;
}

function requireTimezone(timezone: string | undefined): string {
  const tz = (timezone ?? "America/Los_Angeles").trim() || "America/Los_Angeles";
  try {
    // Throws RangeError for unknown IANA zones.
    Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    throw new AutomationError(`Unknown timezone: ${tz}`);
  }
  return tz;
}

export function toAutomationDto(row: PearlAutomation): AutomationDto {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    triggerKind: row.triggerKind,
    triggerConfig: row.triggerConfig ?? {},
    timezone: row.timezone,
    notifyPush: row.notifyPush,
    notifyEmail: row.notifyEmail,
    enabled: row.enabled,
    eveScheduleName: row.eveScheduleName,
    lastChatId: row.lastChatId,
    scheduleSummary: formatScheduleSummary(
      row.triggerKind,
      row.triggerConfig,
      row.timezone,
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAutomations(
  userId: string,
): Promise<readonly AutomationDto[]> {
  const rows = await db
    .select()
    .from(pearlAutomation)
    .where(eq(pearlAutomation.userId, userId))
    .orderBy(desc(pearlAutomation.updatedAt));
  return rows.map(toAutomationDto);
}

export async function getAutomation(
  userId: string,
  id: string,
): Promise<AutomationDto | null> {
  const [row] = await db
    .select()
    .from(pearlAutomation)
    .where(
      and(eq(pearlAutomation.id, id), eq(pearlAutomation.userId, userId)),
    )
    .limit(1);
  return row ? toAutomationDto(row) : null;
}

export async function getAutomationByEveName(
  eveScheduleName: string,
): Promise<PearlAutomation | null> {
  const [row] = await db
    .select()
    .from(pearlAutomation)
    .where(eq(pearlAutomation.eveScheduleName, eveScheduleName))
    .limit(1);
  return row ?? null;
}

export async function getAutomationByChatId(
  chatId: string,
): Promise<PearlAutomation | null> {
  const [row] = await db
    .select()
    .from(pearlAutomation)
    .where(eq(pearlAutomation.lastChatId, chatId))
    .limit(1);
  return row ?? null;
}

export function parseWriteInput(body: unknown): AutomationWriteInput {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (!isTriggerKind(raw.triggerKind)) {
    throw new AutomationError("Pick a trigger schedule.");
  }
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    instructions: typeof raw.instructions === "string" ? raw.instructions : "",
    triggerKind: raw.triggerKind,
    triggerConfig:
      raw.triggerConfig && typeof raw.triggerConfig === "object"
        ? (raw.triggerConfig as PearlAutomationTriggerConfig)
        : undefined,
    timezone: typeof raw.timezone === "string" ? raw.timezone : undefined,
    notifyPush:
      typeof raw.notifyPush === "boolean" ? raw.notifyPush : undefined,
    notifyEmail:
      typeof raw.notifyEmail === "boolean" ? raw.notifyEmail : undefined,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : undefined,
  };
}

export type NormalizedAutomationFields = {
  readonly name: string;
  readonly instructions: string;
  readonly triggerKind: AutomationWriteInput["triggerKind"];
  readonly triggerConfig: PearlAutomationTriggerConfig;
  readonly timezone: string;
  readonly notifyPush: boolean;
  readonly notifyEmail: boolean;
  readonly enabled: boolean;
};

export function normalizeWriteInput(
  input: AutomationWriteInput,
  defaults?: {
    readonly notifyPush?: boolean;
    readonly notifyEmail?: boolean;
    readonly enabled?: boolean;
  },
): NormalizedAutomationFields {
  const timezone = requireTimezone(input.timezone);
  return {
    name: requireName(input.name),
    instructions: requireInstructions(input.instructions),
    triggerKind: input.triggerKind,
    triggerConfig: normalizeTriggerConfig(
      input.triggerKind,
      input.triggerConfig,
      timezone,
    ),
    timezone,
    notifyPush: input.notifyPush ?? defaults?.notifyPush ?? true,
    notifyEmail: input.notifyEmail ?? defaults?.notifyEmail ?? true,
    enabled: input.enabled ?? defaults?.enabled ?? true,
  };
}

export async function insertAutomationMirror(input: {
  readonly userId: string;
  readonly fields: NormalizedAutomationFields;
  readonly eveScheduleName: string;
}): Promise<AutomationDto> {
  const now = new Date();
  const [row] = await db
    .insert(pearlAutomation)
    .values({
      id: randomUUID(),
      userId: input.userId,
      name: input.fields.name,
      instructions: input.fields.instructions,
      triggerKind: input.fields.triggerKind,
      triggerConfig: input.fields.triggerConfig,
      timezone: input.fields.timezone,
      notifyPush: input.fields.notifyPush,
      notifyEmail: input.fields.notifyEmail,
      enabled: input.fields.enabled,
      eveScheduleName: input.eveScheduleName,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new AutomationError("Failed to save automation.");
  return toAutomationDto(row);
}

export async function updateAutomationMirror(input: {
  readonly userId: string;
  readonly id: string;
  readonly fields: NormalizedAutomationFields;
  readonly eveScheduleName?: string;
}): Promise<AutomationDto> {
  const now = new Date();
  const [row] = await db
    .update(pearlAutomation)
    .set({
      name: input.fields.name,
      instructions: input.fields.instructions,
      triggerKind: input.fields.triggerKind,
      triggerConfig: input.fields.triggerConfig,
      timezone: input.fields.timezone,
      notifyPush: input.fields.notifyPush,
      notifyEmail: input.fields.notifyEmail,
      enabled: input.fields.enabled,
      ...(input.eveScheduleName
        ? { eveScheduleName: input.eveScheduleName }
        : {}),
      updatedAt: now,
    })
    .where(
      and(
        eq(pearlAutomation.id, input.id),
        eq(pearlAutomation.userId, input.userId),
      ),
    )
    .returning();
  if (!row) throw new AutomationError("Automation not found.");
  return toAutomationDto(row);
}

export async function setAutomationEnabled(input: {
  readonly userId: string;
  readonly id: string;
  readonly enabled: boolean;
}): Promise<AutomationDto> {
  const now = new Date();
  const [row] = await db
    .update(pearlAutomation)
    .set({ enabled: input.enabled, updatedAt: now })
    .where(
      and(
        eq(pearlAutomation.id, input.id),
        eq(pearlAutomation.userId, input.userId),
      ),
    )
    .returning();
  if (!row) throw new AutomationError("Automation not found.");
  return toAutomationDto(row);
}

export async function deleteAutomationMirror(input: {
  readonly userId: string;
  readonly id: string;
}): Promise<boolean> {
  const deleted = await db
    .delete(pearlAutomation)
    .where(
      and(
        eq(pearlAutomation.id, input.id),
        eq(pearlAutomation.userId, input.userId),
      ),
    )
    .returning({ id: pearlAutomation.id });
  return deleted.length > 0;
}

export async function setAutomationLastChat(input: {
  readonly eveScheduleName: string;
  readonly chatId: string;
}): Promise<void> {
  await db
    .update(pearlAutomation)
    .set({ lastChatId: input.chatId, updatedAt: new Date() })
    .where(eq(pearlAutomation.eveScheduleName, input.eveScheduleName));
}
