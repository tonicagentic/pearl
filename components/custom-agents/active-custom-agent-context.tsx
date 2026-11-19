"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CustomAgentRef } from "@/lib/custom-agents/types";

type ActiveCustomAgentContextValue = {
  readonly agent: CustomAgentRef | null;
  readonly setAgent: (agent: CustomAgentRef | null) => void;
  readonly updateAgent: (patch: Partial<CustomAgentRef>) => void;
};

const ActiveCustomAgentContext =
  createContext<ActiveCustomAgentContextValue | null>(null);

export function ActiveCustomAgentProvider({
  agent: initialAgent,
  children,
}: {
  readonly agent: CustomAgentRef | null;
  readonly children: ReactNode;
}) {
  const [agent, setAgentState] = useState<CustomAgentRef | null>(initialAgent);

  useEffect(() => {
    setAgentState(initialAgent);
  }, [initialAgent]);

  const setAgent = useCallback((next: CustomAgentRef | null) => {
    setAgentState(next);
  }, []);

  const updateAgent = useCallback((patch: Partial<CustomAgentRef>) => {
    setAgentState((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({ agent, setAgent, updateAgent }),
    [agent, setAgent, updateAgent],
  );

  return (
    <ActiveCustomAgentContext.Provider value={value}>
      {children}
    </ActiveCustomAgentContext.Provider>
  );
}

export function useActiveCustomAgent(): ActiveCustomAgentContextValue {
  const value = useContext(ActiveCustomAgentContext);
  if (!value) {
    return {
      agent: null,
      setAgent: () => {},
      updateAgent: () => {},
    };
  }
  return value;
}
