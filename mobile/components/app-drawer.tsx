import { Pressable, Text, View } from "react-native";
import { Link, router, usePathname } from "expo-router";
import { type DrawerContentComponentProps } from "expo-router/drawer";
import { InboxIcon, PlusIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import { cn } from "@/lib/utils";

/**
 * The drawer content, mirroring the web app's sidebar: New session, the
 * Issues inbox, the list of chat threads, and the account at the bottom.
 */
export function AppDrawer({ navigation }: DrawerContentComponentProps) {
  const pathname = usePathname() ?? "/";
  const { signedIn, viewerEmail, signOut } = useAuth();
  // SafeAreaView is a native codegen view: uniwind's className binding can't
  // reach it (same as the safe-area containers in the routes), so the drawer
  // panel's background must be painted through style — a className background
  // is silently dropped and the drawer renders transparent, stacking its
  // content over whatever is on screen.
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  // The drawer-typed navigation arrives as drawerContent props; the ambient
  // useNavigation() inside the content resolves the parent navigator instead,
  // whose object has no drawer methods (closeDrawer was undefined).
  const close = () => navigation.closeDrawer();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} className="flex-1">
      <View className="flex-1 px-2 pt-2">
        <Text className="px-2 pb-2 text-sm font-semibold text-foreground">Pearl</Text>

        {/* New session: lands on the chat with a fresh composer. The session
            itself is the running eve session for now — multi-chat is a later
            parity item. */}
        <Link
          href="/"
          onPress={close}
          className={cn(
            "h-8 flex-row items-center gap-2 rounded-md px-2",
            pathname === "/" ? "bg-muted/50" : "opacity-80",
          )}
        >
          <PlusIcon className="size-4 text-foreground" />
          <Text className="text-sm text-foreground">New session</Text>
        </Link>

        {/* Issues inbox */}
        <Link
          href="/issues"
          onPress={close}
          className={cn(
            "h-8 flex-row items-center gap-2 rounded-md px-2",
            pathname.startsWith("/issues") ? "bg-muted/50" : "opacity-80",
          )}
        >
          <InboxIcon className="size-4 text-foreground" />
          <Text className="text-sm text-foreground">Issues</Text>
        </Link>

        {/* Chat threads */}
        <Text className="px-2 pb-1 pt-4 text-xs font-medium uppercase text-muted-foreground">
          Chats
        </Text>
        <Link
          href="/"
          onPress={close}
          className={cn(
            "h-8 flex-row items-center rounded-md px-2",
            pathname === "/" ? "bg-muted/50" : "opacity-80",
          )}
        >
          <Text className="text-sm text-foreground" numberOfLines={1}>
            Current session
          </Text>
        </Link>
      </View>

      {/* Account */}
      <View className="border-t border-border px-2 py-2">
        {signedIn ? (
          <>
            <Text className="px-2 pb-1 text-xs text-muted-foreground" numberOfLines={1}>
              {viewerEmail}
            </Text>
            <Pressable
              className="h-8 items-start rounded-md px-2"
              onPress={() => {
                signOut();
                close();
                router.navigate("/");
              }}
            >
              <Text className="text-sm text-muted-foreground">Sign out</Text>
            </Pressable>
          </>
        ) : (
          <Text className="px-2 py-1 text-xs text-muted-foreground">Signed out</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
