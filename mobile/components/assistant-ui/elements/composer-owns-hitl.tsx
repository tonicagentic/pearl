import { createContext, useContext } from "react";

/** True while the composer shell owns interactive HITL controls. */
export const ComposerOwnsHitlContext = createContext(false);

export function useComposerOwnsHitl(): boolean {
  return useContext(ComposerOwnsHitlContext);
}
