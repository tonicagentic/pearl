import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useCSSVariable } from "uniwind";

/** Dark-safe fallbacks when CSS vars are briefly undefined (never light hex in dark). */
const FALLBACKS = {
  light: {
    background: "#F7F7F8",
    card: "#FFFFFF",
    foreground: "#111111",
    border: "#E5E5EA",
    muted: "#EFEFF0",
    secondary: "#EFEFF0",
    primary: "#2A9D8F",
  },
  dark: {
    background: "#000000",
    card: "#111111",
    foreground: "#F5F5F7",
    border: "#2C2C2E",
    muted: "#1C1C1E",
    secondary: "#2C2C2E",
    primary: "#2A9D8F",
  },
} as const;

type Scheme = keyof typeof FALLBACKS;

function resolveScheme(scheme: string | null | undefined): Scheme {
  return scheme === "dark" ? "dark" : "light";
}

export function usePearlColorScheme(): Scheme {
  return resolveScheme(useColorScheme());
}

/** Page / scene background — never falls back to `#FFFFFF` in dark mode. */
export function usePearlScreenBackground(): string {
  const scheme = usePearlColorScheme();
  const token = useCSSVariable("--color-background") as string | undefined;
  return token ?? FALLBACKS[scheme].background;
}

export function usePearlCardBackground(): string {
  const scheme = usePearlColorScheme();
  const token = useCSSVariable("--color-card") as string | undefined;
  return token ?? FALLBACKS[scheme].card;
}

export function usePearlMutedBackground(): string {
  const scheme = usePearlColorScheme();
  const token = useCSSVariable("--color-muted") as string | undefined;
  return token ?? FALLBACKS[scheme].muted;
}

export function usePearlSecondaryBackground(): string {
  const scheme = usePearlColorScheme();
  const token = useCSSVariable("--color-secondary") as string | undefined;
  return token ?? FALLBACKS[scheme].secondary;
}

/** Drawer panel surface — secondary so it reads against the scene background. */
export function usePearlDrawerBackground(): string {
  return usePearlSecondaryBackground();
}

/**
 * Selected-row wash on the drawer. Theme muted matches secondary, so a
 * plain muted fill would vanish — use a scheme-aware overlay instead.
 */
export function usePearlDrawerSelectedBackground(): string {
  const scheme = usePearlColorScheme();
  return scheme === "dark"
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.06)";
}

export function usePearlForeground(): string {
  const scheme = usePearlColorScheme();
  const token = useCSSVariable("--color-foreground") as string | undefined;
  return token ?? FALLBACKS[scheme].foreground;
}

/** Header back chevron / tint — stops light-system chrome flashing in dark. */
export function usePearlHeaderTint(): string {
  return usePearlForeground();
}

/** Soft press wash for drawer / list rows. */
export function usePearlPressWash(): string {
  const scheme = usePearlColorScheme();
  return scheme === "dark"
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.04)";
}

/** Hairline border for solid glass fallbacks. */
export function usePearlHairlineBorder(): string {
  const scheme = usePearlColorScheme();
  return scheme === "dark"
    ? "rgba(255,255,255,0.12)"
    : "rgba(0,0,0,0.08)";
}

/**
 * React Navigation theme built from Pearl uniwind tokens so stack
 * `contentStyle` / cards paint dark before CSS vars settle.
 */
export function usePearlNavigationTheme(): Theme {
  const scheme = usePearlColorScheme();
  const background = usePearlScreenBackground();
  const card = usePearlCardBackground();
  const text = usePearlForeground();
  const border =
    (useCSSVariable("--color-border") as string | undefined) ??
    FALLBACKS[scheme].border;
  const primary =
    (useCSSVariable("--color-primary") as string | undefined) ??
    FALLBACKS[scheme].primary;
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return useMemo(
    () => ({
      ...base,
      dark: scheme === "dark",
      colors: {
        ...base.colors,
        primary,
        background,
        card,
        text,
        border,
      },
    }),
    [base, background, border, card, primary, scheme, text],
  );
}

/** Shared stack `screenOptions` for nested drawer stacks (opaque headers). */
export function usePearlStackScreenOptions() {
  const backgroundColor = usePearlScreenBackground();
  const headerTintColor = usePearlHeaderTint();
  return useMemo(
    () => ({
      contentStyle: { backgroundColor },
      headerStyle: { backgroundColor },
      headerTintColor,
      headerShadowVisible: false as const,
      headerBackButtonDisplayMode: "minimal" as const,
      headerShown: true as const,
    }),
    [backgroundColor, headerTintColor],
  );
}
