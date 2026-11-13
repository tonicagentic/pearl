import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SubagentTranscriptTarget } from "@/components/assistant-ui/elements/subagent-transcript-sheet";

type SubagentInspectContextValue = {
  readonly target: SubagentTranscriptTarget | null;
  readonly open: (target: SubagentTranscriptTarget) => void;
  readonly close: () => void;
};

const SubagentInspectContext = createContext<SubagentInspectContextValue>({
  target: null,
  open: () => {},
  close: () => {},
});

export function SubagentInspectProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [target, setTarget] = useState<SubagentTranscriptTarget | null>(null);
  const open = useCallback((next: SubagentTranscriptTarget) => {
    setTarget(next);
  }, []);
  const close = useCallback(() => setTarget(null), []);
  const value = useMemo(
    () => ({ target, open, close }),
    [target, open, close],
  );
  return (
    <SubagentInspectContext.Provider value={value}>
      {children}
    </SubagentInspectContext.Provider>
  );
}

export function useSubagentInspect(): SubagentInspectContextValue {
  return useContext(SubagentInspectContext);
}
