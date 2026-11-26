/** Tools + eval coverage for the /dev/evals Tools tab. */

export type ToolsCatalogToolKind =
  | "authored"
  | "builtin"
  | "connection"
  | "subagent";

export type ToolsCatalogEvalRef = {
  readonly id: string;
  readonly suite: string;
  readonly name: string;
  readonly description: string;
  /** Gate labels that mention this tool, e.g. `calledTool(web_search)`. */
  readonly gates: readonly string[];
};

export type ToolsCatalogTool = {
  readonly name: string;
  readonly kind: ToolsCatalogToolKind;
  /** Connection id when kind is connection (e.g. vercel). */
  readonly connectionId?: string;
  /** Short note: path, connection surface, or harness default. */
  readonly origin: string;
  readonly description: string;
  readonly evals: readonly ToolsCatalogEvalRef[];
};

export type ToolsCatalogAgent = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tools: readonly ToolsCatalogTool[];
  /** Distinct evals that gate on any tool this agent exposes. */
  readonly coveredToolCount: number;
  readonly toolCount: number;
  readonly evalCount: number;
};
