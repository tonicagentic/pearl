import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AgentTemplateList } from "@/components/home/agent-template-browser";
import { ScreenChrome } from "@/components/navigation/screen-chrome";

/** Template directory list — tap a row to open details, then add from there. */
export function AgentDirectoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ readonly projectId?: string }>();
  const projectId =
    typeof params.projectId === "string" ? params.projectId : null;

  return (
    <ScreenChrome title="Templates" leading="drawer" wrapBody={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-4 pb-10 pt-2"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <AgentTemplateList
          projectId={projectId}
          onSelect={(slug) =>
            router.push(
              projectId
                ? `/agent-directory/${slug}?projectId=${encodeURIComponent(projectId)}`
                : `/agent-directory/${slug}`,
              { withAnchor: true },
            )
          }
        />
      </ScrollView>
    </ScreenChrome>
  );
}
