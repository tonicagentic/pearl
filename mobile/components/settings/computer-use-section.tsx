import { router } from "expo-router";
import { MonitorIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { SettingsRow } from "@/components/ui/settings-row";

/** Profile section for Computer Use sandbox settings. */
export function ComputerUseSection() {
  return (
    <Section title="Computer Use">
      <SettingsRow
        icon={<Icon as={MonitorIcon} className="size-5 text-sky-600" />}
        label="Computer Use"
        detail="Browser and sandboxes"
        onPress={() => router.push("/computer-use")}
      />
    </Section>
  );
}
