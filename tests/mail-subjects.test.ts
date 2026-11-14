import assert from "node:assert/strict";
import { test } from "node:test";

import {
  connectionSubjectForMailbox,
  gmailConnectionSlug,
  isLegacyMailboxSubject,
  mailboxSubjectId,
} from "../lib/mail/subjects.ts";
import { matchMailRule } from "../lib/mail/rule-match.ts";

test("legacy mailbox subject is the Better Auth user id", () => {
  assert.equal(isLegacyMailboxSubject("user_1", "user_1"), true);
  assert.equal(isLegacyMailboxSubject("user_1", "user_1:gmail:abc"), false);
  assert.equal(mailboxSubjectId("user_1", "abc"), "user_1:gmail:abc");
  assert.deepEqual(connectionSubjectForMailbox("user_1", "user_1"), {
    type: "user",
    id: "user_1",
    issuer: "better-auth",
  });
  assert.deepEqual(
    connectionSubjectForMailbox("user_1", "user_1:gmail:abc"),
    {
      type: "user",
      id: "user_1:gmail:abc",
      issuer: "better-auth",
    },
  );
});

test("gmail connection slug prefers a sanitized email", () => {
  assert.equal(
    gmailConnectionSlug({ id: "uuid", emailLabel: "Alex@Work.com" }),
    "gmail_alex_work_com",
  );
  assert.match(
    gmailConnectionSlug({ id: "abcdef12-3456-7890", emailLabel: null }),
    /^gmail_abcdef123456$/,
  );
});

test("mail rules require at least one matcher", () => {
  const empty = matchMailRule(
    [
      {
        id: "r1",
        userId: "u",
        mailAccountId: null,
        matchFrom: null,
        matchList: null,
        matchSubject: null,
        action: "archive",
        labelId: null,
        labelName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    { accountId: "a1", from: "receipts@store.com", subject: "Your receipt" },
  );
  assert.equal(empty, null);

  const hit = matchMailRule(
    [
      {
        id: "r2",
        userId: "u",
        mailAccountId: null,
        matchFrom: "receipts@",
        matchList: null,
        matchSubject: null,
        action: "archive",
        labelId: null,
        labelName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    { accountId: "a1", from: "receipts@store.com", subject: "Your receipt" },
  );
  assert.equal(hit?.id, "r2");
});

test("batch approval summary names actions and samples", async () => {
  const { summarizeBatchForApproval } = await import(
    "../lib/agent/gmail-modify-summary.ts"
  );
  const text = summarizeBatchForApproval([
    {
      accountId: "a1",
      threadId: "t1",
      action: { type: "archive" },
      from: "news@list.com",
      subject: "Weekly digest",
    },
    {
      accountId: "a1",
      threadId: "t2",
      action: { type: "mark_read" },
      from: "bot@saas.com",
      subject: "Usage report",
    },
  ]);
  assert.match(text, /2 thread/);
  assert.match(text, /archive: 1/);
  assert.match(text, /mark_read: 1/);
  assert.match(text, /Weekly digest/);
});
