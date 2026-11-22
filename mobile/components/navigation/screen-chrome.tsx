import type { ComponentProps, ReactNode } from "react";
import {
  Platform,
  Pressable,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { DrawerButton } from "@/components/navigation/drawer-button";
import { HeaderDrawerButton } from "@/components/navigation/header-drawer-button";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { Icon } from "@/components/ui/icon";
import { StackScreen } from "@/components/ui/stack-screen";

const HIT = 44;
const IS_IOS = Platform.OS === "ios";

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
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const { open: drawerOpen } = usePearlDrawer();

  // Hide leading while the drawer is open so it doesn’t stack over the panel.
  const showLeading = leading !== "none" && !(IS_IOS && drawerOpen);
  // iOS transparent headers: bare glyph inside shared liquid glass so the
  // control morphs into the system back chevron on push (Delegate → chat).
  const iosGlassLeading = IS_IOS && transparentHeader;
  const leadingNode =
    leading === "history" ? (
      <HistoryLeadingButton variant={iosGlassLeading ? "bare" : "disc"} />
    ) : leading === "drawer" ? (
      iosGlassLeading ? (
        <HistoryLeadingButton variant="bare" />
      ) : (
        <HeaderDrawerButton />
      )
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
          headerTransparent: transparentHeader && IS_IOS,
          headerStyle:
            transparentHeader && IS_IOS
              ? undefined
              : { backgroundColor },
          headerTitle: titleSlot
            ? () => <>{titleSlot}</>
            : undefined,
          // iOS: leading lives on Stack.Toolbar only. Putting DrawerButton in
          // headerLeft stacks under the liquid-glass chrome as extra pills.
          headerLeft: IS_IOS
            ? () => null
            : showLeading && leadingNode
              ? () => (
                  <View
                    style={{
                      width: HIT,
                      height: HIT,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {leadingNode}
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
      {IS_IOS && showLeading && leadingNode ? (
        <Stack.Toolbar placement="left">
          {/*
            Keep shared liquid glass (no hidesSharedBackground) so this
            leading control morphs into the pushed screen’s back button.
          */}
          <Stack.Toolbar.View>
            <View style={{ width: HIT, height: HIT }}>{leadingNode}</View>
          </Stack.Toolbar.View>
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
