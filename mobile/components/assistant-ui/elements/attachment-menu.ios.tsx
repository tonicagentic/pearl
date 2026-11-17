import { Button, Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { PaperclipIcon } from "lucide-react-native";
import { View } from "react-native";

import {
  pinComposerIfKeyboardVisible,
  useComposerChrome,
} from "@/components/assistant-ui/elements/composer-chrome";
import { composerControlHitSlop } from "@/components/assistant-ui/elements/icon-button";
import { Icon } from "@/components/ui/icon";
import type { AttachmentMenuProps } from "./attachment-menu";

const ATTACHMENT_TOUCH = 32 + composerControlHitSlop * 2;

/** Match the model switcher's anchored native menu without changing pickers. */
export function AttachmentMenu({
  disabled,
  onTakePhoto,
  onChoosePhoto,
  onChooseFile,
}: AttachmentMenuProps) {
  const chrome = useComposerChrome();
  return (
    <Host
      style={{
        width: ATTACHMENT_TOUCH,
        height: ATTACHMENT_TOUCH,
        margin: -composerControlHitSlop,
        backgroundColor: "transparent",
      }}
      ignoreSafeArea="keyboard"
    >
      <Menu
        label={
          <RNHostView matchContents>
            <View
              style={{
                width: ATTACHMENT_TOUCH,
                height: ATTACHMENT_TOUCH,
                alignItems: "center",
                justifyContent: "center",
              }}
              // Host/Menu does not bubble touches to the action row — pin here
              // before the menu resigns the field and drops the keyboard.
              onTouchStart={() => {
                pinComposerIfKeyboardVisible(chrome);
                if (disabled) return;
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {},
                );
              }}
            >
              <View className="bg-muted size-8 items-center justify-center rounded-full">
                <Icon as={PaperclipIcon} size={14} className="text-foreground" />
              </View>
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
