import { Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { ListTodoIcon } from "lucide-react-native";

import { SheetScaffold } from "@/components/settings/sheet-scaffold";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SettingsCard } from "@/components/ui/settings-card";
import { Text } from "@/components/ui/text";

const PEARL_TASKS_URL = "pearltasks://";

/**
 * Profile → Tasks. A short ad for the Pearl Tasks companion app.
 */
export function TasksScreen() {
  return (
    <SheetScaffold
      footer={
        <View className="gap-2 pt-1">
          <Button label="Open Pearl Tasks" onPress={() => void openPearlTasks()} />
          <Text variant="caption" className="text-center">
            Same account as Pearl on this phone.
          </Text>
        </View>
      }
    >
      <View className="items-center gap-3 px-2 pt-6">
        <View className="size-[76px] items-center justify-center rounded-[22px] bg-teal-500/15">
          <Icon as={ListTodoIcon} className="size-9 text-teal-600" />
        </View>
        <Text variant="caption" weight="medium">
          Pearl Tasks
        </Text>
        <Text variant="display" className="text-center tracking-tight">
          Tasks and projects, in one place.
        </Text>
        <Text variant="body" tone="muted" className="text-center leading-[23px]">
          The companion app for what you need to do and the projects those tasks
          belong to. Inbox for unfiled work. Projects for a body of work that
          outlives one chat.
        </Text>
      </View>

      <PreviewCard />
    </SheetScaffold>
  );
}

function PreviewCard() {
  return (
    <View className="gap-1.5">
      <Text variant="secondary" weight="medium" className="px-1">
        Preview
      </Text>
      <SettingsCard>
        <View className="gap-4 px-4 py-4">
          <Text variant="secondary" weight="medium">
            Inbox
          </Text>
          <View className="gap-3">
            <PreviewRow title="Follow up on lease renewal" detail="Due today" />
            <View className="h-px bg-border" />
            <PreviewRow title="Book dentist" detail="Review next week" />
          </View>
          <View className="h-px bg-border" />
          <Text variant="secondary" weight="medium">
            Projects
          </Text>
          <PreviewRow title="Kitchen remodel" detail="3 open tasks" />
        </View>
      </SettingsCard>
      <Text variant="caption" className="px-1">
        Sample of the Pearl Tasks home screen.
      </Text>
    </View>
  );
}

function PreviewRow({
  title,
  detail,
}: {
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <View className="gap-0.5">
      <Text variant="label" numberOfLines={1}>
        {title}
      </Text>
      <Text variant="secondary">{detail}</Text>
    </View>
  );
}

async function openPearlTasks() {
  try {
    await Linking.openURL(PEARL_TASKS_URL);
  } catch {
    Alert.alert(
      "Pearl Tasks",
      "Pearl Tasks isn't installed on this phone.",
    );
  }
}
