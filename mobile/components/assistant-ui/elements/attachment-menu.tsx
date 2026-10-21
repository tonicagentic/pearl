import { ComposerPrimitive } from "@assistant-ui/react-native";
import { PlusIcon } from "lucide-react-native";
import { Alert, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { iconButtonHitSlop } from "./icon-button";

export type AttachmentMenuProps = {
  disabled: boolean;
  onChoosePhoto: () => void;
  onChooseFile: () => void;
  onPasteText: () => void;
};

/** Android and web retain the existing attachment choices. */
export function AttachmentMenu({ disabled, onChoosePhoto, onChooseFile, onPasteText }: AttachmentMenuProps) {
  return (
    <View>
      <ComposerPrimitive.AddAttachment
        onPress={() => Alert.alert("Add attachment", undefined, [
          { text: "Choose Photo", onPress: onChoosePhoto },
          { text: "Choose File", onPress: onChooseFile },
          { text: "Paste Text", onPress: onPasteText },
          { text: "Cancel", style: "cancel" },
        ])}
        disabled={disabled}
        className="aui-composer-add-attachment active:bg-muted size-11 items-center justify-center rounded-full"
        hitSlop={iconButtonHitSlop}
        accessibilityLabel="Add attachment"
      >
        <Icon as={PlusIcon} className="text-muted-foreground size-5" />
      </ComposerPrimitive.AddAttachment>
    </View>
  );
}
