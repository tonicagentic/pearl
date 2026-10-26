import { Button, Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import { PlusIcon } from "lucide-react-native";
import { useColorScheme, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { AttachmentMenuProps } from "./attachment-menu";

/** Match the model switcher's anchored native menu without changing pickers. */
export function AttachmentMenu({ disabled, onChoosePhoto, onChooseFile, onPasteText }: AttachmentMenuProps) {
  const dark = useColorScheme() === "dark";
  // Stronger than --color-muted so the 32pt circle reads on the glass shell
  // like Grok's + (muted alone washes out against the composer fill).
  const chipFill = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";

  return (
    <Host style={{ width: 32, height: 32, backgroundColor: "transparent" }} ignoreSafeArea="keyboard">
      <Menu
        label={
          <RNHostView matchContents>
            <View
              className="size-8 items-center justify-center rounded-full"
              style={{ backgroundColor: chipFill }}
            >
              <Icon as={PlusIcon} size={14} className="text-foreground" />
            </View>
          </RNHostView>
        }
        modifiers={[nativeDisabled(disabled), accessibilityLabel("Add attachment")]}
      >
        <Button label="Choose Photo" systemImage="photo" onPress={onChoosePhoto} />
        <Button label="Choose File" systemImage="doc" onPress={onChooseFile} />
        <Button label="Paste Text" systemImage="doc.on.clipboard" onPress={onPasteText} />
      </Menu>
    </Host>
  );
}
