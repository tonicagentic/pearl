import { getGmailTokenForMailbox } from "@/lib/mail/accounts";

import { summarizeBatchForApproval } from "./gmail-modify-summary.ts";
import type {
  MailBatchAction,
  MailBatchItem,
  MailBatchResult,
} from "./gmail-modify-types.ts";

export type { MailBatchAction, MailBatchItem, MailBatchResult };
export { summarizeBatchForApproval };

function modifyBody(action: MailBatchAction): {
  readonly addLabelIds?: string[];
  readonly removeLabelIds?: string[];
} {
  switch (action.type) {
    case "archive":
      return { removeLabelIds: ["INBOX"] };
    case "mark_read":
      return { removeLabelIds: ["UNREAD"] };
    case "add_label":
      return { addLabelIds: [action.labelId] };
    case "remove_label":
      return { removeLabelIds: [action.labelId] };
  }
}

async function modifyThread(
  token: string,
  threadId: string,
  action: MailBatchAction,
): Promise<void> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(modifyBody(action)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    throw new Error(
      `Gmail modify responded ${res.status}${
        res.status === 403
          ? " (grant likely lacks gmail.modify — reconnect the mailbox in Settings → Email)"
          : ""
      }: ${detail}`,
    );
  }
}

/** Apply archive / mark-read / label changes across mailboxes. */
export async function executeMailBatch(
  userId: string,
  items: readonly MailBatchItem[],
): Promise<{
  readonly results: readonly MailBatchResult[];
  readonly applied: number;
  readonly failed: number;
}> {
  const tokenByAccount = new Map<string, string>();
  const results: MailBatchResult[] = [];

  for (const item of items) {
    try {
      let token = tokenByAccount.get(item.accountId);
      if (!token) {
        const resolved = await getGmailTokenForMailbox(
          userId,
          item.accountId,
        );
        token = resolved.token;
        tokenByAccount.set(item.accountId, token);
      }
      await modifyThread(token, item.threadId, item.action);
      results.push({
        threadId: item.threadId,
        accountId: item.accountId,
        ok: true,
      });
    } catch (cause) {
      results.push({
        threadId: item.threadId,
        accountId: item.accountId,
        ok: false,
        error: cause instanceof Error ? cause.message : "Modify failed.",
      });
    }
  }

  return {
    results,
    applied: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
  };
}
