"use client";

import { createContext, useContext } from "react";

export type MindMapActions = {
  persistLabel: (id: string, label: string) => void;
  updateNodeLabel: (id: string, label: string) => void;
};

const MindMapActionsContext = createContext<MindMapActions | null>(null);

export const MindMapActionsProvider = MindMapActionsContext.Provider;

export function useMindMapActions(): MindMapActions {
  const value = useContext(MindMapActionsContext);

  if (!value) {
    throw new Error("useMindMapActions must be used within the mind map.");
  }

  return value;
}
