import { defineDynamic, defineInstructions } from "eve/instructions";
import { currentDatetime } from "../../lib/agent/session-context.ts";

// Pins the current moment for every turn. System-role at turn scope: applied
// fresh each turn and kept outside durable history, so old timestamps never
// accumulate into context (the model would otherwise read a stale one).

export default defineDynamic(() =>
  defineInstructions({
    content: currentDatetime(),
    role: "system",
  }),
);
