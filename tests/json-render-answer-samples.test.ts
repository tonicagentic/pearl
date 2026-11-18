import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseInlineSpec } from "../lib/json-render/inline-spec.ts";
import { ANSWER_THREAD_SAMPLES } from "../mobile/src/thread-samples-answers.ts";

const EXPECTED_ROOT_CHILD: Record<string, string> = {
  "answer-web": "SearchResults",
  "answer-location": "PlaceMap",
  "answer-places": "PlaceMap",
  "answer-products": "SearchResults",
  "answer-brief": "NewsBrief",
  "answer-entry": "Encyclopedia",
  "answer-pronounce": "Pronounce",
  "answer-phrase": "Phrase",
  "answer-chord": "GuitarChord",
  "answer-theory": "TheoryBoard",
  "answer-votes": "ComparisonBar",
  "answer-table": "Table",
  "answer-explain": "Explainer",
  "answer-recipe": "Recipe",
  "answer-chart": "Chart",
  "answer-spec": "SpecSheet",
  "answer-mermaid": "MermaidDiagram",
  "answer-flight": "FlightTracker",
  "answer-event": "CalendarEvent",
  "answer-create-event": "CreateEvent",
  "answer-booking": "Booking",
  "answer-email-draft": "EmailDraft",
  "answer-email-batch": "EmailBatch",
  "answer-surf": "SurfReport",
  "answer-surf-pick": "SurfSpotPick",
  "answer-snow": "SnowReport",
  "answer-mountain-pick": "MountainPick",
  "answer-daily": "DailyBrief",
  "answer-video": "Video",
  "answer-vercel-project": "VercelProject",
  "answer-deploy": "DeploymentStatus",
  "answer-deploy-list": "DeploymentList",
  "answer-pr": "PullRequest",
  "answer-pr-list": "PullRequestList",
  "answer-issue": "Issue",
  "answer-issue-list": "IssueList",
  "answer-neon-project": "NeonProject",
  "answer-neon-branch": "NeonBranch",
  "answer-schema": "SchemaOverview",
  "answer-ship": "ShipStatus",
  "answer-env-names": "EnvVarList",
  "answer-domains": "DomainList",
  "answer-slow-queries": "SlowQueryList",
  "answer-repo-pick": "RepoPick",
  "answer-project-pick": "ProjectPick",
  "answer-neon-branch-pick": "NeonBranchPick",
  "answer-photo-edit": "PhotoEditSettings",
  "answer-music-prod": "MusicProdSettings",
  "answer-storyboard": "VideoStoryboard",
  "answer-indicator": "IndicatorCard",
  "answer-slides": "Slides",
  "answer-pdf": "PdfArtifact",
};

function assistantText(sample: (typeof ANSWER_THREAD_SAMPLES)[number]): string {
  const assistant = [...sample.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  assert.ok(assistant, `${sample.id} missing assistant message`);
  const content = assistant.content;
  if (typeof content === "string") return content;
  assert.ok(Array.isArray(content), `${sample.id} content is not parts`);
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        part != null &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

describe("answer thread samples", () => {
  it("includes fifty-two answer fixtures", () => {
    assert.equal(ANSWER_THREAD_SAMPLES.length, 52);
  });

  for (const sample of ANSWER_THREAD_SAMPLES) {
    it(`parses ${sample.id} spec as Card → ${EXPECTED_ROOT_CHILD[sample.id]}`, () => {
      assert.equal(sample.group, "answer");
      const text = assistantText(sample);
      const parsed = parseInlineSpec(text);
      assert.equal(parsed.hasSpec, true, `${sample.id} should embed a spec`);
      assert.ok(parsed.spec, `${sample.id} missing compiled spec`);
      assert.equal(parsed.spec.elements[parsed.spec.root]?.type, "Card");

      const expected = EXPECTED_ROOT_CHILD[sample.id];
      assert.ok(expected, `missing expectation for ${sample.id}`);
      const childTypes = Object.values(parsed.spec.elements).map(
        (element) => element?.type,
      );
      assert.ok(
        childTypes.includes(expected),
        `${sample.id} expected child type ${expected}, got ${childTypes.join(", ")}`,
      );
    });
  }
});
