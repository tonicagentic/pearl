/** Friendly schedule shapes shown in the Automations UI. */
export type PearlAutomationTriggerKind =
  | "once"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "annually";

/** Trigger fields the UI edits; mapped to eve ScheduleExpression at write time. */
export type PearlAutomationTriggerConfig = {
  readonly hour?: number;
  readonly minute?: number;
  readonly startHour?: number;
  readonly endHour?: number;
  readonly weekday?: number;
  readonly dayOfMonth?: number;
  readonly month?: number;
  /** Local `YYYY-MM-DDTHH:mm` for Once. */
  readonly runAt?: string;
};

/** eve ScheduleExpression shape (single or cron). */
export type AutomationScheduleExpression =
  | {
      readonly type: "single";
      readonly at: string;
      readonly timezone: string;
    }
  | {
      readonly type: "cron";
      readonly cron: string;
      readonly timezone: string;
    };

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

export type AutomationWriteInput = {
  readonly name: string;
  readonly instructions: string;
  readonly triggerKind: PearlAutomationTriggerKind;
  readonly triggerConfig?: PearlAutomationTriggerConfig;
  readonly timezone?: string;
  readonly notifyPush?: boolean;
  readonly notifyEmail?: boolean;
  readonly enabled?: boolean;
};

export const TRIGGER_KINDS = [
  "once",
  "hourly",
  "daily",
  "weekdays",
  "weekly",
  "monthly",
  "annually",
] as const satisfies readonly PearlAutomationTriggerKind[];

export function isTriggerKind(value: unknown): value is PearlAutomationTriggerKind {
  return (
    typeof value === "string" &&
    (TRIGGER_KINDS as readonly string[]).includes(value)
  );
}
