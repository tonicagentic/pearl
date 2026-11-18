import { caModule } from "./ca";
import { coModule } from "./co";
import { nyModule } from "./ny";
import type { StateTaxModule } from "./types";

export type { StateComputeContext, StateComputeResult, StateTaxModule } from "./types";
export { caModule, coModule, nyModule };

const MODULES: Record<string, StateTaxModule> = {
  CA: caModule,
  CO: coModule,
  NY: nyModule,
};

export function stateModuleFor(residentState: string): StateTaxModule | null {
  return MODULES[residentState.toUpperCase()] ?? null;
}

export function supportedResidentStates(): string[] {
  return Object.keys(MODULES);
}
