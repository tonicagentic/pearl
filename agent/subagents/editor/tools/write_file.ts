import { disableTool } from "eve/tools";

// The editor grades and returns feedback; it never writes files. Revisions
// are applied by the parent agent so the author keeps one pen.
export default disableTool();
