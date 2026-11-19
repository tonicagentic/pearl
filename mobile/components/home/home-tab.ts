export const HOME_TABS = ["pearl", "agents"] as const;

export type HomeTab = (typeof HOME_TABS)[number];

export const HOME_TAB_LABEL: Record<HomeTab, string> = {
  pearl: "Chat",
  agents: "Agents",
};
