import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/client";
import {
  mailRule,
  type MailRuleAction,
  type MailRuleRow,
} from "@/lib/db/schema";

export {
  matchMailRule,
  type ThreadMatchInput,
} from "@/lib/mail/rule-match";

export type MailRuleInput = {
  readonly mailAccountId?: string | null;
  readonly matchFrom?: string | null;
  readonly matchList?: string | null;
  readonly matchSubject?: string | null;
  readonly action: MailRuleAction;
  readonly labelId?: string | null;
  readonly labelName?: string | null;
};

export async function listMailRules(
  userId: string,
): Promise<readonly MailRuleRow[]> {
  return db
    .select()
    .from(mailRule)
    .where(eq(mailRule.userId, userId))
    .orderBy(asc(mailRule.createdAt));
}

export async function createMailRule(
  userId: string,
  input: MailRuleInput,
): Promise<MailRuleRow> {
  if (input.action === "label" && !input.labelId?.trim()) {
    throw new Error("labelId is required when action is label.");
  }
  const [row] = await db
    .insert(mailRule)
    .values({
      id: randomUUID(),
      userId,
      mailAccountId: input.mailAccountId ?? null,
      matchFrom: input.matchFrom?.trim() || null,
      matchList: input.matchList?.trim() || null,
      matchSubject: input.matchSubject?.trim() || null,
      action: input.action,
      labelId: input.labelId?.trim() || null,
      labelName: input.labelName?.trim() || null,
    })
    .returning();
  if (!row) throw new Error("Could not create mail rule.");
  return row;
}

export async function deleteMailRule(
  userId: string,
  ruleId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(mailRule)
    .where(and(eq(mailRule.userId, userId), eq(mailRule.id, ruleId)))
    .returning({ id: mailRule.id });
  return deleted.length > 0;
}
