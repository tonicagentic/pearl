import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCoderFileTree,
  deriveCoderJobProgress,
  extractCoderHandoff,
  parseCoderHandoff,
} from "../lib/chat/coder-receipt.ts";

const HANDOFF = {
  summary: "Added card-swap on the blog.",
  repo: {
    owner: "alextingiris",
    name: "public-portfolio",
    url: "https://github.com/alextingiris/public-portfolio",
    branch: "feat/card-swap",
  },
  pullRequest: {
    url: "https://github.com/alextingiris/public-portfolio/pull/12",
    number: 12,
    title: "Card-swap blog posts",
    draft: true,
  },
  files: [
    { path: "src/components/CardSwap.tsx", additions: 40, deletions: 2 },
    { path: "app/blog/page.tsx", additions: 8, deletions: 3 },
  ],
  preview: {
    url: "https://public-portfolio-git-feat.vercel.app",
    httpStatus: 200,
    authWall: false,
  },
};

test("parseCoderHandoff reads a nested tool result", () => {
  const handoff = parseCoderHandoff({ status: "ok", handoff: HANDOFF });
  assert.equal(handoff?.repo?.name, "public-portfolio");
  assert.equal(handoff?.pullRequest?.number, 12);
  assert.equal(handoff?.files?.length, 2);
});

test("extractCoderHandoff prefers the child report_handoff tool result", () => {
  const fromChild = extractCoderHandoff({
    runResult: { summary: "stale" },
    childMessages: [
      {
        parts: [
          {
            type: "tool",
            name: "report_handoff",
            state: "completed",
            output: { status: "ok", handoff: HANDOFF },
          },
        ],
      },
    ],
  });
  assert.equal(fromChild?.summary, HANDOFF.summary);
});

test("extractCoderHandoff falls back to the completed run output", () => {
  const fromRun = extractCoderHandoff({
    runResult: { summary: HANDOFF.summary, handoff: HANDOFF },
  });
  assert.equal(fromRun?.repo?.owner, "alextingiris");
});

test("deriveCoderJobProgress advances with child tools", () => {
  const progress = deriveCoderJobProgress([
    {
      parts: [
        { type: "tool", name: "bash", input: { command: "git clone ..." } },
        { type: "tool", name: "write_file", input: { filePath: "x.tsx" } },
        { type: "tool", name: "bash", input: { command: "pnpm test" } },
      ],
    },
  ]);
  assert.equal(progress.stageIndex, 2);
  assert.equal(progress.stages[2]?.name, "checks");
});

test("buildCoderFileTree groups files under folders", () => {
  const tree = buildCoderFileTree(HANDOFF.files);
  assert.equal(tree.totalAdditions, 48);
  assert.equal(tree.totalDeletions, 5);
  assert.ok(tree.nodes.some((n) => n.kind === "folder"));
  assert.equal(tree.nodes.filter((n) => n.kind === "file").length, 2);
});

test("deriveCoderJobProgress reaches preview for preview_check", () => {
  const progress = deriveCoderJobProgress([
    {
      parts: [
        { type: "tool", name: "deploy_vercel" },
        { type: "tool", name: "preview_check" },
      ],
    },
  ]);
  assert.equal(progress.stages[progress.stageIndex]?.name, "preview");
});
