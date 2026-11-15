import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildApprovalBrief,
  formatApprovalPrompt,
  isDefaultApprovalPrompt,
} from "../lib/chat/approval-brief.ts";

test("isDefaultApprovalPrompt matches eve one-liners", () => {
  assert.equal(isDefaultApprovalPrompt("Approve Gated git?"), true);
  assert.equal(isDefaultApprovalPrompt("Approve Deploy vercel?"), true);
  assert.equal(isDefaultApprovalPrompt(null), true);
  assert.equal(
    isDefaultApprovalPrompt(
      "Send this email?\nTo: a@b.com\nSubject: Hi\n\nBody",
    ),
    false,
  );
});

test("gated_git push brief names repo, command, and branch", () => {
  const brief = buildApprovalBrief({
    toolName: "gated_git",
    prompt: "Approve Gated git?",
    input: {
      command: "git push -u origin feat/card-swap",
      owner: "alex",
      repo: "public-portfolio",
      branch: "feat/card-swap",
    },
  });

  assert.match(brief.headline, /Push alex\/public-portfolio/);
  assert.match(brief.headline, /feat\/card-swap/);
  assert.ok(brief.detail);
  assert.match(brief.detail!, /git push -u origin feat\/card-swap/);
  assert.match(brief.detail!, /Branch: feat\/card-swap/);
  assert.match(brief.detail!, /First push/i);
});

test("gated_git draft PR brief uses draft title", () => {
  const brief = buildApprovalBrief({
    toolName: "gated_git",
    prompt: "Approve Gated git?",
    input: {
      command: "gh pr create --draft --title \"Card swap\"",
      owner: "alex",
      repo: "public-portfolio",
      branch: "feat/card-swap",
    },
  });

  assert.match(brief.headline, /Draft PR alex\/public-portfolio/);
  assert.ok(brief.detail);
  assert.match(brief.detail!, /gh pr create --draft/);
});

test("production deploy for Pearl warns about phone API", () => {
  const brief = buildApprovalBrief({
    toolName: "deploy_vercel",
    prompt: "Approve Deploy vercel?",
    input: {
      target: "production",
      owner: "alex",
      repo: "my-agent",
    },
  });

  assert.match(brief.headline, /Production deploy alex\/my-agent/);
  assert.ok(brief.detail);
  assert.match(brief.detail!, /API the phone is using/);
});

test("custom multi-line prompt splits into headline and detail", () => {
  const prompt =
    "Send this email?\nTo: a@b.com\nSubject: Hi\n\nHello there";
  const brief = buildApprovalBrief({
    toolName: "send_gmail_message",
    prompt,
    input: {
      to: "a@b.com",
      subject: "Hi",
      body: "Hello there",
      password: "should-not-appear",
    },
  });

  assert.equal(brief.headline, "Send this email?");
  assert.equal(brief.detail, "To: a@b.com\nSubject: Hi\n\nHello there");
  assert.doesNotMatch(brief.detail ?? "", /hunter2|should-not-appear/);
});

test("generic brief lists scalar fields and redacts secrets", () => {
  const brief = buildApprovalBrief({
    toolName: "sheets__update_values",
    prompt: "Approve Update values?",
    input: {
      spreadsheetId: "sheet-123",
      range: "A1:B2",
      token: "secret-token-value",
      password: "hunter2",
      idempotencyKey: "k1",
      values: [
        ["a", "b"],
        ["c", "d"],
      ],
    },
  });

  assert.match(brief.headline, /Approve Update values/i);
  assert.ok(brief.detail);
  assert.match(brief.detail!, /spreadsheetId: sheet-123/);
  assert.match(brief.detail!, /range: A1:B2/);
  assert.doesNotMatch(brief.detail!, /secret-token-value/);
  assert.doesNotMatch(brief.detail!, /hunter2/);
  assert.doesNotMatch(brief.detail!, /idempotencyKey/);
});

test("run_with_env lists names never values", () => {
  const brief = buildApprovalBrief({
    toolName: "run_with_env",
    input: {
      command: "pnpm build",
      names: ["DATABASE_URL", "VERCEL_TOKEN"],
      target: "production",
    },
  });

  assert.match(brief.headline, /production env/i);
  assert.ok(brief.detail);
  assert.match(brief.detail!, /pnpm build/);
  assert.match(brief.detail!, /DATABASE_URL/);
  assert.match(brief.detail!, /Values are never shown/);
  assert.doesNotMatch(brief.detail!, /postgres:\/\//);
});

test("formatApprovalPrompt joins headline and detail", () => {
  const text = formatApprovalPrompt({
    toolName: "gated_git",
    input: {
      command: "git push origin main",
      owner: "alex",
      repo: "public-portfolio",
      branch: "main",
    },
  });
  assert.match(text, /Push alex\/public-portfolio/);
  assert.match(text, /git push origin main/);
});

test("scrubSecrets redacts leaked connection strings in detail", () => {
  const brief = buildApprovalBrief({
    toolName: "confirm_step",
    prompt: "Approve Confirm step?",
    input: {
      summary: "connect postgres://user:pass@host/db and ship",
    },
  });
  assert.ok(brief.detail);
  assert.doesNotMatch(brief.detail!, /postgres:\/\/user:pass/);
  assert.match(brief.detail!, /\[redacted-db-url\]/);
});
