import type { ComponentProps, ReactNode } from "react";
import {
  Platform,
  Pressable,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import type { LucideIcon } from "lucide-react-native";
import { ChevronLeftIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import {
  DRAWER_BUTTON_SIZE,
  DrawerButton,
} from "@/components/navigation/drawer-button";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { useLockDrawerSwipeOnStackBack } from "@/components/navigation/drawer-swipe-sync";
import { Icon } from "@/components/ui/icon";
import { StackScreen } from "@/components/ui/stack-screen";

/** Shared header control hit target (drawer, Android actions, custom back). */
export const HEADER_CONTROL_SIZE = DRAWER_BUTTON_SIZE;
const HIT = HEADER_CONTROL_SIZE;
const IS_IOS = Platform.OS === "ios";
/** System menu glyph — Toolbar.Button gets real liquid-glass press + circle. */
const DRAWER_TOOLBAR_ICON = "line.3.horizontal" as const;

/** SF Symbol name for Stack.Toolbar; kept loose so call sites stay ergonomic. */
type ToolbarSymbol = ComponentProps<typeof Stack.Toolbar.Button>["icon"];

export type ScreenChromeMenuItem = {
  readonly label: string;
  readonly systemImage?: ToolbarSymbol;
  readonly onPress: () => void;
  readonly destructive?: boolean;
  readonly hidden?: boolean;
};

export type ScreenChromeAction =
  | {
      readonly type?: "button";
      readonly label: string;
      readonly systemImage?: ToolbarSymbol;
      readonly icon?: LucideIcon;
      readonly onPress: () => void;
      readonly hidden?: boolean;
      readonly separateBackground?: boolean;
      readonly selected?: boolean;
      readonly disabled?: boolean;
    }
  | {
      readonly type: "menu";
      readonly label: string;
      readonly systemImage?: ToolbarSymbol;
      readonly icon?: LucideIcon;
      readonly hidden?: boolean;
      /** Android header tap (typically opens an Alert). iOS uses `items`. */
      readonly onPress?: () => void;
      readonly items: readonly ScreenChromeMenuItem[];
    }
  | {
      readonly type: "spacer";
      readonly width?: number;
      readonly hidden?: boolean;
    };

type SearchBarTextEvent = NativeSyntheticEvent<{ readonly text: string }>;

export type ScreenChromeSearch = {
  readonly placeholder: string;
  /** When true, SearchBar only mounts on iOS (Android uses inline search). */
  readonly iosOnly?: boolean;
  readonly hideWhenScrolling?: boolean;
  readonly autoCapitalize?: "none" | "sentences" | "words" | "characters";
  readonly onChangeText: (event: SearchBarTextEvent) => void;
  readonly onCancelButtonPress?: () => void;
};

type ScreenChromeProps = {
  readonly title?: string;
  readonly titleSlot?: ReactNode;
  /**
   * - `drawer` / `history`: menu control that opens the Expo drawer
   * - `back`: system back (or `onBack` when the screen is not stack-backed)
   * - `none`: no leading control (system back still available on pushed screens)
   */
  readonly leading?: "drawer" | "history" | "back" | "none";
  /** Custom back handler (e.g. workbench). Only used with `leading="back"`. */
  readonly onBack?: () => void;
  readonly actions?: readonly ScreenChromeAction[];
  readonly search?: ScreenChromeSearch;
  /** When false, only header/toolbar chrome — caller owns the body shell. */
  readonly wrapBody?: boolean;
  readonly contentPaddingTop?: number;
  readonly children: ReactNode;
};

function HistoryLeadingButton({
  variant = "disc",
}: {
  readonly variant?: "disc" | "bare";
}) {
  const { openDrawer } = usePearlDrawer();
  return (
    <DrawerButton
      onPress={openDrawer}
      accessibilityLabel="Open menu"
      variant={variant}
    />
  );
}

function AndroidHeaderControl({
  label,
  onPress,
  children,
  disabled,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: HIT,
        height: HIT,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </Pressable>
  );
}

function AndroidActionButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  if (!icon) return null;
  return (
    <AndroidHeaderControl label={label} onPress={onPress} disabled={disabled}>
      <Icon as={icon} className="size-5 text-foreground" />
    </AndroidHeaderControl>
  );
}

function renderAndroidActions(actions: readonly ScreenChromeAction[]) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {visible.map((action, index) => {
        if (action.type === "spacer") {
          return (
            <View key={`spacer-${index}`} style={{ width: action.width ?? 8 }} />
          );
        }
        if (action.type === "menu") {
          const press =
            action.onPress ??
            action.items.find((item) => !item.hidden)?.onPress;
          if (!press || !action.icon) return null;
          return (
            <AndroidActionButton
              key={`menu-${action.label}-${index}`}
              label={action.label}
              icon={action.icon}
              onPress={press}
            />
          );
        }
        return (
          <AndroidActionButton
            key={`btn-${action.label}-${index}`}
            label={action.label}
            icon={action.icon}
            onPress={action.onPress}
            disabled={action.disabled}
          />
        );
      })}
    </View>
  );
}

/**
 * Shared drawer-destination chrome: Stack header options, 44×44 leading,
 * platform trailing actions, optional SearchBar, StackScreen body.
 *
 * Body rule: with the native header shown, wrap content in StackScreen /
 * SheetScaffold (no SafeArea `top` edge). On iOS, Liquid Glass makes the
 * header layout-transparent — pad the body by `useHeaderHeight()` so chips
 * and titles are not drawn under the status bar. Hub scrollers should set
 * `contentInsetAdjustmentBehavior="automatic"`.
 */
export function ScreenChrome({
  title = "",
  titleSlot,
  leading = "drawer",
  onBack,
  actions = [],
  search,
  wrapBody = true,
  contentPaddingTop = 12,
  children,
}: ScreenChromeProps) {
  const { openDrawer } = usePearlDrawer();
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const showDrawerLeading = leading === "drawer" || leading === "history";
  const showCustomBack = leading === "back" && Boolean(onBack);
  // Prefer stack back gesture over full-width drawer swipe when pushed.
  useLockDrawerSwipeOnStackBack(leading === "back");
  // Liquid Glass forces a transparent header for layout; body starts at y=0
  // unless we pad by the measured nav+status height.
  const headerHeight = useHeaderHeight();
  const bodyPadTop =
    (IS_IOS ? headerHeight : 0) + contentPaddingTop;

  const androidLeading = showDrawerLeading ? (
    <HistoryLeadingButton variant="disc" />
  ) : showCustomBack ? (
    <AndroidHeaderControl label="Back" onPress={onBack!}>
      <Icon as={ChevronLeftIcon} className="size-6 text-foreground" />
    </AndroidHeaderControl>
  ) : null;

  const androidRight = renderAndroidActions(actions);
  const showSearch =
    search != null && (IS_IOS || search.iosOnly !== true);

  const header = (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: titleSlot ? "" : title,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
          // Android only — iOS system bar needs no headerStyle at all.
          ...(IS_IOS ? {} : { headerStyle: { backgroundColor } }),
          headerTitle: titleSlot
            ? () => <>{titleSlot}</>
            : undefined,
          // iOS: omit headerLeft so the system back slot stays native.
          // Drawer / custom-back live on Stack.Toolbar (iOS) or headerLeft (Android).
          headerLeft: IS_IOS
            ? undefined
            : androidLeading
              ? () => (
                  <View
                    style={{
                      width: HIT,
                      height: HIT,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {androidLeading}
                  </View>
                )
              : undefined,
          headerBackVisible: showCustomBack ? false : undefined,
          headerRight:
            IS_IOS
              ? undefined
              : androidRight
                ? () => androidRight
                : undefined,
        }}
      />
      {IS_IOS && showDrawerLeading ? (
        <Stack.Toolbar placement="left">
          {/*
            Native Toolbar.Button — circular liquid glass + press interaction
            and morph into the system back chevron on push. Custom Toolbar.View
            glass cannot match that feel.
          */}
          <Stack.Toolbar.Button
            icon={DRAWER_TOOLBAR_ICON}
            accessibilityLabel="Open menu"
            onPress={openDrawer}
          />
        </Stack.Toolbar>
      ) : null}
      {IS_IOS && showCustomBack ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="chevron.left"
            accessibilityLabel="Back"
            onPress={onBack}
          />
        </Stack.Toolbar>
      ) : null}
      {IS_IOS && actions.length > 0 ? (
        <Stack.Toolbar placement="right">
          {actions.map((action, index) => {
            if (action.hidden) {
              if (action.type === "spacer") {
                return (
                  <Stack.Toolbar.Spacer
                    key={`spacer-${index}`}
                    width={action.width ?? 8}
                    hidden
                  />
                );
              }
              if (action.type === "menu") {
                return (
                  <Stack.Toolbar.Menu
                    key={`menu-${action.label}-${index}`}
                    icon={action.systemImage ?? "ellipsis"}
                    accessibilityLabel={action.label}
                    hidden
                  />
                );
              }
              return (
                <Stack.Toolbar.Button
                  key={`btn-${action.label}-${index}`}
                  icon={action.systemImage ?? "circle"}
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  separateBackground={action.separateBackground}
                  selected={action.selected}
                  disabled={action.disabled}
                  hidden
                />
              );
            }
            if (action.type === "spacer") {
              return (
                <Stack.Toolbar.Spacer
                  key={`spacer-${index}`}
                  width={action.width ?? 8}
                />
              );
            }
            if (action.type === "menu") {
              return (
                <Stack.Toolbar.Menu
                  key={`menu-${action.label}-${index}`}
                  icon={action.systemImage ?? "ellipsis"}
                  accessibilityLabel={action.label}
                >
                  {action.items
                    .filter((item) => !item.hidden)
                    .map((item) => (
                      <Stack.Toolbar.MenuAction
                        key={item.label}
                        icon={item.systemImage}
                        destructive={item.destructive}
                        onPress={item.onPress}
                      >
                        {item.label}
                      </Stack.Toolbar.MenuAction>
                    ))}
                </Stack.Toolbar.Menu>
              );
            }
            return (
              <Stack.Toolbar.Button
                key={`btn-${action.label}-${index}`}
                icon={action.systemImage ?? "circle"}
                accessibilityLabel={action.label}
                onPress={action.onPress}
                separateBackground={action.separateBackground}
                selected={action.selected}
                disabled={action.disabled}
              />
            );
          })}
        </Stack.Toolbar>
      ) : null}
      {showSearch && search ? (
        <Stack.SearchBar
          placeholder={search.placeholder}
          hideWhenScrolling={search.hideWhenScrolling ?? true}
          autoCapitalize={search.autoCapitalize ?? "none"}
          onChangeText={search.onChangeText}
          onCancelButtonPress={search.onCancelButtonPress}
        />
      ) : null}
    </>
  );

  if (!wrapBody) {
    return (
      <>
        {header}
        {children}
      </>
    );
  }

  return (
    <StackScreen>
      {header}
      <View style={{ flex: 1, paddingTop: bodyPadTop }}>{children}</View>
    </StackScreen>
  );
}
