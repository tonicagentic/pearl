import { askQuestion } from "eve/tools/ask_question";

/**
 * Opt-in eve HITL question tool. Parks the turn for one clarifying question
 * (optional two–three choices, or free text). Primary callers: Schema Designer
 * interviews and Goals start/setup walkthroughs. Prefer this over asking the
 * same clarifying question in the message body.
 */
export default askQuestion;
