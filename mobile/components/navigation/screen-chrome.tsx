import type { ComponentProps, ReactNode } from "react";
import {
  Platform,
  Pressable,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack } from "expo-router";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import type { LucideIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import {
  DRAWER_BUTTON_SIZE,
  DrawerButton,
} from "@/components/navigation/drawer-button";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { Icon } from "@/components/ui/icon";
import { StackScreen } from "@/components/ui/stack-screen";

const HIT = DRAWER_BUTTON_SIZE;
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
  readonly leading?: "drawer" | "history" | "none";
  readonly actions?: readonly ScreenChromeAction[];
  readonly search?: ScreenChromeSearch;
  readonly transparentHeader?: boolean;
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

function AndroidActionButton({
  label,
  icon,
  onPress,
}: {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly onPress: () => void;
}) {
  if (!icon) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: HIT,
        height: HIT,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon as={icon} className="size-5 text-foreground" />
    </Pressable>
  );
}

function renderAndroidActions(actions: readonly ScreenChromeAction[]) {
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {visible.map((action, index) => {
        if (action.type === "spacer") {
          return <View key={`spacer-${index}`} style={{ width: action.width ?? 8 }} />;
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
          />
        );
      })}
    </View>
  );
}

/**
 * Shared drawer-destination chrome: Stack header options, 44×44 leading,
 * platform trailing actions, optional SearchBar, StackScreen body.
 */
export function ScreenChrome({
  title = "",
  titleSlot,
  leading = "drawer",
  actions = [],
  search,
  transparentHeader = false,
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
  // Keep the leading control on the peeked scene while the drawer is open.
  const showDrawerLeading = leading === "drawer" || leading === "history";
  const androidLeading = showDrawerLeading ? (
    <HistoryLeadingButton variant="disc" />
  ) : null;

  const androidRight = renderAndroidActions(actions);
  const showSearch =
    search != null && (IS_IOS || search.iosOnly !== true);
  // Home passes transparentHeader so the thread draws under the bar. Other
  // screens keep headerTransparent false (content stays below the bar) but
  // must not paint an opaque headerStyle — that opts out of liquid glass.
  const liquidGlassBar = IS_IOS && isLiquidGlassAvailable();
  const underlapHeader = transparentHeader && IS_IOS;

  const header = (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: titleSlot ? "" : title,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
          headerTransparent: underlapHeader
            ? true
            : liquidGlassBar
              ? false
              : undefined,
          headerStyle: underlapHeader
            ? undefined
            : {
                backgroundColor: liquidGlassBar
                  ? "transparent"
                  : backgroundColor,
              },
          headerTitle: titleSlot
            ? () => <>{titleSlot}</>
            : undefined,
          // iOS: leading lives on Stack.Toolbar only. Putting DrawerButton in
          // headerLeft stacks under the liquid-glass chrome as extra pills.
          headerLeft: IS_IOS
            ? () => null
            : showDrawerLeading && androidLeading
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
              : () => null,
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
      <View style={{ flex: 1, paddingTop: contentPaddingTop }}>{children}</View>
    </StackScreen>
  );
}
