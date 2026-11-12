import { Button, Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import { PaperclipIcon } from "lucide-react-native";
import { View } from "react-native";

import {
  pinComposerIfKeyboardVisible,
  useComposerChrome,
} from "@/components/assistant-ui/elements/composer-chrome";
import { Icon } from "@/components/ui/icon";
import type { AttachmentMenuProps } from "./attachment-menu";

/** Match the model switcher's anchored native menu without changing pickers. */
export function AttachmentMenu({
  disabled,
  onTakePhoto,
  onChoosePhoto,
  onChooseFile,
}: AttachmentMenuProps) {
  const chrome = useComposerChrome();
  return (
    <Host style={{ width: 32, height: 32, backgroundColor: "transparent" }} ignoreSafeArea="keyboard">
      <Menu
        label={
          <RNHostView matchContents>
            <View
              className="bg-muted size-8 items-center justify-center rounded-full"
              // Host/Menu does not bubble touches to the action row — pin here
              // before the menu resigns the field and drops the keyboard.
              onTouchStart={() => pinComposerIfKeyboardVisible(chrome)}
            >
              <Icon as={PaperclipIcon} size={14} className="text-foreground" />
            </View>
          </RNHostView>
        }
        modifiers={[nativeDisabled(disabled), accessibilityLabel("Add attachment")]}
      >
        <Button label="Take Photo" systemImage="camera" onPress={onTakePhoto} />
        <Button label="Choose Photo" systemImage="photo" onPress={onChoosePhoto} />
        <Button label="Choose File" systemImage="doc" onPress={onChooseFile} />
      </Menu>
    </Host>
  );
}
