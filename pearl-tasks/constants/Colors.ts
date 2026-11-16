export type ThemeColors = {
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  tint: string;
  danger: string;
  success: string;
};

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    border: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
    tint: "#0F766E",
    danger: "#E11D48",
    success: "#059669",
  },
  dark: {
    background: "#0B1220",
    card: "#111827",
    border: "#1F2937",
    text: "#F8FAFC",
    muted: "#94A3B8",
    tint: "#2DD4BF",
    danger: "#FB7185",
    success: "#34D399",
  },
};
