import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as nativeDisabled } from "@expo/ui/swift-ui/modifiers";
import { useCSSVariable } from "uniwind";
import type { AttachmentMenuProps } from "./attachment-menu";

/** Match the model switcher's anchored native menu without changing pickers. */
export function AttachmentMenu({ disabled, onChoosePhoto, onChooseFile, onPasteText }: AttachmentMenuProps) {
  const foreground = useCSSVariable("--color-foreground") as string | undefined;
  return (
    <Host style={{ width: 44, height: 44 }} ignoreSafeArea="keyboard">
      <Menu
        label={<Image systemName="plus" size={25} color={foreground ?? "#111114"} />}
        modifiers={[nativeDisabled(disabled), accessibilityLabel("Add attachment")]}
      >
        <Button label="Choose Photo" systemImage="photo" onPress={onChoosePhoto} />
        <Button label="Choose File" systemImage="doc" onPress={onChooseFile} />
        <Button label="Paste Text" systemImage="doc.on.clipboard" onPress={onPasteText} />
      </Menu>
    </Host>
  );
}
