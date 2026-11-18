/** Shared option row for RepoPick / ProjectPick / NeonBranchPick. */
export type PickOption = {
  readonly name: string;
  readonly detail: string | null;
  readonly meta: string | null;
};

export type PickProps = {
  readonly pick: string;
  readonly reason: string | null;
  readonly timeframe: string | null;
  readonly options: readonly PickOption[];
};

export function isPickOption(name: string, pick: string): boolean {
  return name === pick;
}
