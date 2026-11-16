import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useSession } from "@/lib/auth";
import { Loading, Screen, useTheme } from "@/components/ui";

function AuthGate({ children }: { readonly children: React.ReactNode }) {
  const { data, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    const onSignIn = segments[0] === "sign-in";
    if (!data && !onSignIn) {
      router.replace("/sign-in");
    } else if (data && onSignIn) {
      router.replace("/(tabs)");
    }
  }, [data, isPending, router, segments]);

  if (isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return children;
}

function RootNavigator() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style="auto" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
          <Stack.Screen name="task/new" options={{ title: "New task", presentation: "modal" }} />
          <Stack.Screen name="project/[id]" options={{ title: "Project" }} />
          <Stack.Screen
            name="project/new"
            options={{ title: "New project", presentation: "modal" }}
          />
        </Stack>
      </AuthGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
