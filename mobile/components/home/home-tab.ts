export const HOME_TABS = ["pearl", "track"] as const;

export type HomeTab = (typeof HOME_TABS)[number];

export const HOME_TAB_LABEL: Record<HomeTab, string> = {
  pearl: "Chat",
  track: "Overview",
};
