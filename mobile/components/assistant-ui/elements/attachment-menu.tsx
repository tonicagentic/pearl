import { ComposerPrimitive } from "@assistant-ui/react-native";
import * as Haptics from "expo-haptics";
import { PaperclipIcon } from "lucide-react-native";
import { Alert, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { composerControlHitSlop, iconButtonHitSlop } from "./icon-button";

export type AttachmentMenuProps = {
  disabled: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onChooseFile: () => void;
};

/** Android and web retain the existing attachment choices. */
export function AttachmentMenu({
  disabled,
  onTakePhoto,
  onChoosePhoto,
  onChooseFile,
}: AttachmentMenuProps) {
  return (
    <View>
      <ComposerPrimitive.AddAttachment
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          Alert.alert("Add attachment", undefined, [
            { text: "Take Photo", onPress: onTakePhoto },
            { text: "Choose Photo", onPress: onChoosePhoto },
            { text: "Choose File", onPress: onChooseFile },
            { text: "Cancel", style: "cancel" },
          ]);
        }}
        disabled={disabled}
        className="aui-composer-add-attachment bg-muted active:bg-muted/80 size-11 items-center justify-center rounded-full"
        hitSlop={Math.max(iconButtonHitSlop, composerControlHitSlop)}
        accessibilityLabel="Add attachment"
      >
        <Icon as={PaperclipIcon} className="text-muted-foreground size-5" />
      </ComposerPrimitive.AddAttachment>
    </View>
  );
}
