import { authedJson, authedVoid } from "./http";

import type {
  PearlAutomationTriggerConfig,
  PearlAutomationTriggerKind,
} from "../../lib/automations/types";

export type AutomationDto = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly triggerKind: PearlAutomationTriggerKind;
  readonly triggerConfig: PearlAutomationTriggerConfig;
  readonly timezone: string;
  readonly notifyPush: boolean;
  readonly notifyEmail: boolean;
  readonly enabled: boolean;
  readonly eveScheduleName: string;
  readonly lastChatId: string | null;
  readonly scheduleSummary: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AutomationWriteBody = {
  readonly name: string;
  readonly instructions: string;
  readonly triggerKind: PearlAutomationTriggerKind;
  readonly triggerConfig?: PearlAutomationTriggerConfig;
  readonly timezone?: string;
  readonly notifyPush?: boolean;
  readonly notifyEmail?: boolean;
  readonly enabled?: boolean;
};

export async function fetchAutomations(): Promise<readonly AutomationDto[]> {
  const data = await authedJson<{ automations: AutomationDto[] }>(
    "/api/automations",
  );
  return data.automations;
}

export async function createAutomationRequest(
  input: AutomationWriteBody,
): Promise<AutomationDto> {
  const data = await authedJson<{ automation: AutomationDto }>(
    "/api/automations",
    { method: "POST", json: input },
  );
  return data.automation;
}

export async function updateAutomationRequest(
  id: string,
  input: Partial<AutomationWriteBody> & { readonly enabled?: boolean },
): Promise<AutomationDto> {
  const data = await authedJson<{ automation: AutomationDto }>(
    `/api/automations/${encodeURIComponent(id)}`,
    { method: "PATCH", json: input },
  );
  return data.automation;
}

export async function deleteAutomationRequest(id: string): Promise<void> {
  await authedVoid(`/api/automations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
