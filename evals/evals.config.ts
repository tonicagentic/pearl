import { gateway } from "ai";
import { defineEvalConfig } from "eve/evals";

// The judge model grades eval assertions (t.judge.autoevals.*) and is never
// the agent under test. String ids route through the Vercel AI Gateway with
// the project's OIDC/gateway credentials.
export default defineEvalConfig({
  judge: { model: gateway("openai/gpt-5.5") },
  maxConcurrency: 2,
  timeoutMs: 120_000,
});
