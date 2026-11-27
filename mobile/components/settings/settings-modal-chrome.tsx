import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useNavigation, usePathname } from "expo-router";
import {
  ChevronLeftIcon,
  InfoIcon,
  SearchIcon,
  XIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  usePearlMutedBackground,
  usePearlScreenBackground,
} from "@/src/navigation-theme";

const TITLE_BY_SEGMENT: Record<string, string> = {
  index: "Settings",
  account: "Account",
  identity: "Identity",
  memory: "Memory",
  capabilities: "Capabilities",
  skills: "Skills",
  plugins: "Plugins",
  email: "Email",
  calendar: "Calendar",
  models: "Models",
  "computer-use": "Computer Use",
  usage: "Usage",
  billing: "Billing",
  about: "About",
  "connected-agents": "Connected agents",
  "self-host": "Self-host",
  money: "Pearl Money",
  answers: "Answers",
  drafting: "Drafting",
  research: "Research",
  visualize: "Visualize",
  design: "Design",
  analysis: "Analysis",
  storage: "Storage",
  plan: "Plan",
  shop: "Shop",
};

type SettingsModalChromeValue = {
  readonly searchOpen: boolean;
  readonly setSearchOpen: (open: boolean) => void;
  readonly isIndex: boolean;
  readonly title: string;
};

const SettingsModalChromeContext =
  createContext<SettingsModalChromeValue | null>(null);

export function useSettingsModalChrome(): SettingsModalChromeValue {
  const value = useContext(SettingsModalChromeContext);
  if (!value) {
    throw new Error(
      "useSettingsModalChrome must be used inside SettingsModalChromeProvider",
    );
  }
  return value;
}

/** Optional for screens that may render outside the modal (tests). */
export function useSettingsModalChromeOptional(): SettingsModalChromeValue | null {
  return useContext(SettingsModalChromeContext);
}

export function SettingsModalChromeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const navigation = useNavigation();
  const [searchOpen, setSearchOpenRaw] = useState(false);
  const [stackIndex, setStackIndex] = useState(
    () => navigation.getState()?.index ?? 0,
  );

  useEffect(() => {
    const sync = () => {
      setStackIndex(navigation.getState()?.index ?? 0);
    };
    sync();
    return navigation.addListener("state", sync);
  }, [navigation]);

  const { isIndex, title } = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    // /settings → index; /settings/account → account; /settings/plugins/x → plugins
    const settingsIdx = parts.indexOf("settings");
    const after =
      settingsIdx >= 0 ? parts.slice(settingsIdx + 1) : parts;
    const segment = after[0] ?? "index";
    const index = after.length === 0;
    const resolvedTitle =
      TITLE_BY_SEGMENT[segment] ??
      (segment.length > 0
        ? segment.charAt(0).toUpperCase() + segment.slice(1)
        : "Settings");
    return {
      isIndex: index,
      title: index ? "Settings" : resolvedTitle,
    };
  }, [pathname]);

  // Prefer real stack history so a deep link like /settings/billing shows X
  // (dismiss) rather than a dead back chevron with nowhere to pop.
  const canGoBack = stackIndex > 0;

  const setSearchOpen = useCallback((open: boolean) => {
    setSearchOpenRaw(open);
  }, []);

  // Leaving the index closes search.
  const value = useMemo(
    () => ({
      searchOpen: isIndex ? searchOpen : false,
      setSearchOpen,
      isIndex,
      title,
    }),
    [isIndex, searchOpen, setSearchOpen, title],
  );

  return (
    <SettingsModalChromeContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        <SettingsModalHeader
          title={title}
          canGoBack={canGoBack}
          isIndex={isIndex}
          searchOpen={value.searchOpen}
          onToggleSearch={() => setSearchOpen(!value.searchOpen)}
        />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </SettingsModalChromeContext.Provider>
  );
}

function SettingsModalHeader({
  title,
  canGoBack,
  isIndex,
  searchOpen,
  onToggleSearch,
}: {
  readonly title: string;
  readonly canGoBack: boolean;
  readonly isIndex: boolean;
  readonly searchOpen: boolean;
  readonly onToggleSearch: () => void;
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = usePearlScreenBackground();
  const mutedColor = usePearlMutedBackground();

  const onLeading = () => {
    if (canGoBack) {
      router.back();
      return;
    }
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.back();
  };

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor,
          paddingTop: Math.max(insets.top, 8),
        },
      ]}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={canGoBack ? "Back" : "Close settings"}
          hitSlop={8}
          onPress={onLeading}
          style={[styles.circle, { backgroundColor: mutedColor }]}
        >
          <Icon
            as={canGoBack ? ChevronLeftIcon : XIcon}
            className="size-5 text-foreground"
          />
        </Pressable>

        <Text
          variant="label"
          weight="semibold"
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </Text>

        {isIndex ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? "Close search" : "Search settings"}
            hitSlop={8}
            onPress={onToggleSearch}
            style={[styles.circle, { backgroundColor: mutedColor }]}
          >
            <Icon
              as={searchOpen ? XIcon : SearchIcon}
              className="size-4 text-foreground"
            />
          </Pressable>
        ) : title !== "About" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="About"
            hitSlop={8}
            onPress={() => router.push("/settings/about")}
            style={[styles.circle, { backgroundColor: mutedColor }]}
          >
            <Icon as={InfoIcon} className="size-4 text-foreground" />
          </Pressable>
        ) : (
          <View style={styles.circleSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 8,
  },
  bar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  circleSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
});
