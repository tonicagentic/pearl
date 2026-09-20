import { disableTool } from "eve/tools";

// A shell could write files or mutate state; the editor is read-only by role.
export default disableTool();
