import { askQuestion } from "eve/tools/ask_question";

/**
 * Opt-in eve HITL question tool. Parks the turn for one clarifying question
 * (optional two–three choices, or free text). Schema Designer interviews are
 * the primary caller; any single parked question may use it.
 */
export default askQuestion;
