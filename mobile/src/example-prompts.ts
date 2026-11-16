/** First-launch / empty-composer prompt chips. */
export const EXAMPLE_PROMPTS = [
  "Help me plan my week",
  "Help me set a goal for this month",
  "Can you help me think this through?",
  "Help me build a simple page for this idea",
  "Create a list of people I should reach out to",
  "Plan a weekend trip",
] as const;

export type ExamplePrompt = (typeof EXAMPLE_PROMPTS)[number];
