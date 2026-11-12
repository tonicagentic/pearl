import { router } from "expo-router";

import { SelfHostScreen } from "@/components/self-host-screen";

/**
 * Self-host / custom agent URL. Available signed-in (Settings) or signed-out
 * (intro). After connect or reset, return home so auth can re-run against the
 * active agent.
 */
export default function SelfHost() {
  return (
    <SelfHostScreen
      onConnected={() => {
        router.replace("/");
      }}
      onUseHosted={() => {
        router.replace("/");
      }}
    />
  );
}
