import { webSearch } from "eve/tools/web_search";

/**
 * Explicit Exa Search via AI Gateway (eve's default). Kept as a project file
 * so billing and instructions can treat the provider as fixed: Exa `auto`
 * at $7 / 1k requests ($0.007 each, up to 10 results).
 */
export default webSearch({ provider: "exa" });
