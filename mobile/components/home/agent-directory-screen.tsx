import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { AgentTemplateList } from "@/components/home/agent-template-browser";
import { ScreenChrome } from "@/components/navigation/screen-chrome";

/** Template directory list — tap a row to open details, then add from there. */
export function AgentDirectoryScreen() {
  const router = useRouter();

  return (
    <ScreenChrome title="Directory" leading="drawer" wrapBody={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-4 pb-10 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <AgentTemplateList
          onSelect={(slug) =>
            router.push(`/agent-directory/${slug}`, { withAnchor: true })
          }
        />
      </ScrollView>
    </ScreenChrome>
  );
}
