import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chipForTool,
  composeActivityHeader,
  lineSpanLabel,
  statusLabelForTool,
  toActivityStep,
  withElapsed,
  type ActivityPart,
  type ActivityToolPart,
} from "../lib/thread-activity.ts";

function tool(
  toolName: string,
  args: Record<string, unknown> = {},
  status: { type?: string } = { type: "complete" },
  result?: unknown,
): ActivityToolPart {
  return {
    type: "tool-call",
    toolName,
    args,
    status,
    result,
  };
}

function reasoning(text = "…"): ActivityPart {
  return { type: "reasoning", text };
}

describe("lineSpanLabel", () => {
  it("formats offset and limit as Lstart–end", () => {
    assert.equal(lineSpanLabel({ offset: 85, limit: 20 }), "L85–104");
  });

  it("assumes offset 1 when only limit is set", () => {
    assert.equal(lineSpanLabel({ limit: 10 }), "L1–10");
  });

  it("returns empty without a limit", () => {
    assert.equal(lineSpanLabel({ offset: 85 }), "");
  });
});

describe("toActivityStep", () => {
  it("names a live reasoning block Thinking", () => {
    const step = toActivityStep(reasoning("plan"), { live: true });
    assert.equal(step.verb, "Thinking");
    assert.equal(step.chip, "");
  });

  it("names a settled reasoning block Thought", () => {
    assert.equal(toActivityStep(reasoning()).verb, "Thought");
  });

  it("reads a file with a line span on the chip", () => {
    const step = toActivityStep(
      tool("read_file", {
        filePath: "/repo/app.json",
        offset: 85,
        limit: 20,
      }),
    );
    assert.equal(step.verb, "Read");
    assert.equal(step.chip, "app.json L85–104");
  });

  it("uses Running / Ran with the command first line", () => {
    const live = toActivityStep(
      tool("bash", { command: "npm test\necho done" }, { type: "running" }),
      { live: true },
    );
    assert.equal(live.verb, "Running");
    assert.equal(live.chip, "npm test");

    const settled = toActivityStep(tool("bash", { command: "npm test" }));
    assert.equal(settled.verb, "Ran");
  });

  it("puts line diffs on edit rows", () => {
    const step = toActivityStep(
      tool("edit_file", {
        filePath: "app.json",
        oldText: "a\nb",
        newText: "a\nb\nc",
      }),
    );
    assert.equal(step.verb, "Edited");
    assert.equal(step.chip, "app.json");
    assert.equal(step.added, 3);
    assert.equal(step.removed, 2);
  });

  it("uses Editing while an edit is live", () => {
    const step = toActivityStep(
      tool("edit_file", { filePath: "app.json", oldText: "a", newText: "b" }),
      { live: true },
    );
    assert.equal(step.verb, "Editing");
  });

  it("loads skills as Loading / Loaded", () => {
    assert.equal(
      toActivityStep(tool("load_skill", { skill: "eas-update" }), {
        live: true,
      }).verb,
      "Loading",
    );
    assert.equal(
      toActivityStep(tool("load_skill", { skill: "eas-update" })).verb,
      "Loaded",
    );
  });

  it("renders failed settled calls as Couldn't + infinitive", () => {
    const failed = toActivityStep(
      tool(
        "bash",
        { command: "git status" },
        { type: "incomplete" },
        { error: "exit 1" },
      ),
    );
    assert.equal(failed.verb, "Couldn't run");
    assert.equal(failed.chip, "git status");

    const skill = toActivityStep(
      tool(
        "load_skill",
        { skill: "eas-update" },
        { type: "complete" },
        { error: "missing" },
      ),
    );
    assert.equal(skill.verb, "Couldn't load");
    assert.equal(skill.chip, "eas-update");
  });

  it("never uses Couldn't while a call is still live", () => {
    const step = toActivityStep(
      tool(
        "bash",
        { command: "git status" },
        { type: "running" },
        { error: "nope" },
      ),
      { live: true },
    );
    assert.equal(step.verb, "Running");
  });

  it("falls back to Using / Used for unknown tools", () => {
    const live = toActivityStep(tool("deploy_something"), { live: true });
    assert.equal(live.verb, "Using");
    assert.equal(live.chip, "Deploy something");

    const settled = toActivityStep(tool("deploy_something"));
    assert.equal(settled.verb, "Used");
  });

  it("lists glob as Listed, not Explored, on the row", () => {
    assert.equal(toActivityStep(tool("glob", { pattern: "**/*.ts" })).verb, "Listed");
  });

  it("creates issues in the past tense", () => {
    assert.equal(
      toActivityStep(tool("create_issue", { title: "Bug" })).verb,
      "Created",
    );
  });
});

describe("composeActivityHeader", () => {
  it("uses Thinking / Thought for reasoning-only segments", () => {
    assert.equal(
      composeActivityHeader([reasoning()], { live: true }).text,
      "Thinking",
    );
    assert.equal(composeActivityHeader([reasoning()]).text, "Thought");
  });

  it("leads with the live call, then finished counts", () => {
    const parts: ActivityPart[] = [
      tool("read_file", { filePath: "app.json" }),
      tool("read_file", { filePath: "eas.json" }),
      tool("bash", { command: "npm test" }, { type: "running" }),
    ];
    assert.equal(
      composeActivityHeader(parts, { live: true }).text,
      "Running npm test, explored 2 files",
    );
  });

  it("settles to past rollups without Thought", () => {
    const parts: ActivityPart[] = [
      tool("read_file", { filePath: "app.json" }),
      tool("bash", { command: "a" }),
      tool("bash", { command: "b" }),
      tool("bash", { command: "c" }),
      tool("bash", { command: "d" }),
    ];
    assert.equal(
      composeActivityHeader(parts).text,
      "Explored 1 file, ran 4 commands",
    );
  });

  it("leads with Editing and keeps finished explored/ran counts", () => {
    const parts: ActivityPart[] = [
      tool("read_file", { filePath: "a.ts" }),
      tool("read_file", { filePath: "b.ts" }),
      tool("bash", { command: "x" }),
      tool("bash", { command: "y" }),
      tool("bash", { command: "z" }),
      tool("bash", { command: "w" }),
      tool(
        "edit_file",
        { filePath: "app.json", oldText: "a", newText: "a\nb" },
        { type: "running" },
      ),
    ];
    const header = composeActivityHeader(parts, { live: true });
    assert.equal(
      header.text,
      "Editing app.json, explored 2 files, ran 4 commands",
    );
    assert.equal(header.added, 2);
    assert.equal(header.removed, 1);
  });

  it("settles a one-file edit as Edited {file}, not Editing", () => {
    const parts: ActivityPart[] = [
      tool("read_file", { filePath: "a.ts" }),
      tool("bash", { command: "x" }),
      tool("edit_file", {
        filePath: "app.json",
        oldText: "a",
        newText: "b",
      }),
    ];
    const header = composeActivityHeader(parts);
    assert.equal(
      header.text,
      "Edited app.json, explored 1 file, ran 1 command",
    );
  });

  it("summarizes several edited files", () => {
    const parts: ActivityPart[] = [
      tool("edit_file", {
        filePath: "a.ts",
        oldText: "a",
        newText: "b",
      }),
      tool("edit_file", {
        filePath: "b.ts",
        oldText: "a",
        newText: "b",
      }),
    ];
    assert.equal(composeActivityHeader(parts).text, "Edited 2 files");
  });

  it("keeps a finished edit when the live step is a read", () => {
    const parts: ActivityPart[] = [
      tool("edit_file", {
        filePath: "app.json",
        oldText: "a",
        newText: "b",
      }),
      tool("bash", { command: "x" }),
      tool(
        "read_file",
        { filePath: "eas.json" },
        { type: "running" },
      ),
    ];
    assert.equal(
      composeActivityHeader(parts, { live: true }).text,
      "Reading eas.json, edited app.json, ran 1 command",
    );
  });

  it("uses Searched N times for search rollups", () => {
    const parts: ActivityPart[] = [
      tool("web_search", { query: "expo ota" }),
    ];
    assert.equal(composeActivityHeader(parts).text, "Searched 1 time");
    assert.equal(
      composeActivityHeader(
        [tool("web_search", { query: "expo ota" }, { type: "running" })],
        { live: true },
      ).text,
      "Searching expo ota",
    );
  });

  it("falls back to the step phrase when there are no rollups", () => {
    assert.equal(
      composeActivityHeader([
        tool("load_skill", { skill: "eas-update" }),
      ]).text,
      "Loaded eas-update",
    );
    assert.equal(
      composeActivityHeader([tool("deploy_something")], { live: true }).text,
      "Using Deploy something",
    );
  });

  it("still counts a failed attempt in the rollup", () => {
    const parts: ActivityPart[] = [
      tool("read_file", { filePath: "a.ts" }),
      tool(
        "bash",
        { command: "false" },
        { type: "incomplete" },
        { error: "1" },
      ),
    ];
    assert.equal(
      composeActivityHeader(parts).text,
      "Explored 1 file, ran 1 command",
    );
    assert.equal(toActivityStep(parts[1]!).verb, "Couldn't run");
  });
});

describe("statusLabelForTool", () => {
  it("uses Writing for uncovered write_file", () => {
    assert.equal(
      statusLabelForTool(
        tool("write_file", { filePath: "notes.md" }, { type: "running" }),
        { live: true },
      ),
      "Writing notes.md",
    );
  });
});

describe("withElapsed", () => {
  it("prepends a worked-for duration", () => {
    assert.equal(
      withElapsed("Edited app.json", "12s"),
      "Worked for 12s · Edited app.json",
    );
    assert.equal(withElapsed("Thinking"), "Thinking");
  });
});

describe("chipForTool", () => {
  it("uses short objects for Expo / deploy chips", () => {
    assert.equal(chipForTool(tool("build_run")), "EAS build");
    assert.equal(chipForTool(tool("preview_check")), "preview");
    assert.equal(chipForTool(tool("deployment_logs")), "logs");
    assert.equal(chipForTool(tool("get_profile")), "profile");
  });
});
