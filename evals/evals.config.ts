import { gateway } from "ai";
import { defineEvalConfig } from "eve/evals";

// The judge model grades eval assertions (t.judge(...)) and is never
// the agent under test. It must be a decision model; the gateway routes it
// with the project's OIDC/gateway credentials.
export default defineEvalConfig({
  judge: { model: gateway.decisionModel("openai/gpt-6-luna-decisions") },
  maxConcurrency: 2,
  timeoutMs: 120_000,
});
