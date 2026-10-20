import { Button, Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import { PlusIcon } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { AttachmentMenuProps } from "./attachment-menu";

/** Match the model switcher's anchored native menu without changing pickers. */
export function AttachmentMenu({ disabled, onChoosePhoto, onChooseFile }: AttachmentMenuProps) {
  return (
    <Host matchContents ignoreSafeArea="keyboard">
      <Menu
        label={
          <RNHostView matchContents>
            <View className="size-11 items-center justify-center">
              <Icon as={PlusIcon} className="text-foreground size-7" />
            </View>
          </RNHostView>
        }
        modifiers={[nativeDisabled(disabled), accessibilityLabel("Add attachment")]}
      >
        <Button label="Choose Photo" systemImage="photo" onPress={onChoosePhoto} />
        <Button label="Choose File" systemImage="doc" onPress={onChooseFile} />
      </Menu>
    </Host>
  );
}
