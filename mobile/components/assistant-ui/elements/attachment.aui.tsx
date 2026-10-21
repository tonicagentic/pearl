import { Icon } from "@/components/ui/icon";
import { AttachmentMenu } from "./attachment-menu";
import {
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { XIcon } from "lucide-react-native";
import type { FC } from "react";
import { Alert, Image, View } from "react-native";
import { uploadPdfAttachment } from "@/src/pdf-attachment";

const MAX_IMAGE_EDGE = 2048;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_BYTES = 16 * 1024;
const MAX_PASTE_CHARS = 64 * 1024;

const encodeJpeg = async (asset: ImagePicker.ImagePickerAsset) => {
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    if (Math.max(asset.width, asset.height) > MAX_IMAGE_EDGE) {
      context.resize(
        asset.width >= asset.height
          ? { width: MAX_IMAGE_EDGE }
          : { height: MAX_IMAGE_EDGE },
      );
    }
    const image = await context.renderAsync();
    try {
      const { base64 } = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
        base64: true,
      });
      return base64;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
};

const useAttachmentImageUri = () =>
  useAuiState((s) => {
    const part = s.attachment.content?.find((c) => c.type === "image");
    return part?.type === "image" ? part.image : undefined;
  });

const AttachmentName: FC = () => (
  <View className="aui-attachment-file bg-muted border-border h-14 max-w-40 justify-center rounded-xl border px-3">
    <AttachmentPrimitive.Name
      className="aui-attachment-name text-foreground text-xs"
      numberOfLines={1}
    />
  </View>
);

const ComposerAttachment: FC = () => {
  const uri = useAttachmentImageUri();

  return (
    <AttachmentPrimitive.Root className="aui-composer-attachment-root relative">
      {uri ? (
        <Image
          source={{ uri }}
          className="aui-composer-attachment-image bg-muted size-14 rounded-xl"
          resizeMode="cover"
        />
      ) : (
        <AttachmentName />
      )}
      <AttachmentPrimitive.Remove
        className="aui-composer-attachment-remove bg-foreground absolute -top-1.5 -right-1.5 size-5 items-center justify-center rounded-full"
        hitSlop={removeHitSlop}
        accessibilityLabel="Remove attachment"
      >
        <Icon as={XIcon} className="text-background size-3" />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};

// Hit slop never extends past the parent view, so the badge grows into the 56dp
// thumbnail root instead of outward: the thumbnail has no tap of its own, and the
// top right of it removing the attachment is the price of a reachable target.
const removeHitSlop = { top: 0, right: 0, bottom: 34, left: 34 };

export const ComposerAttachments: FC = () => (
  <AuiIf condition={(s) => s.composer.attachments.length > 0}>
    <View className="aui-composer-attachments flex-row flex-wrap gap-2 px-1 pt-1">
      <ComposerPrimitive.Attachments>
        {() => <ComposerAttachment />}
      </ComposerPrimitive.Attachments>
    </View>
  </AuiIf>
);

export const ComposerAddAttachment: FC<{
  preparing: boolean;
  onPreparingChange: (preparing: boolean) => void;
}> = ({ preparing, onPreparingChange }) => {
  const aui = useAui();
  const canAttach = useAuiState((s) => s.composer.isEditing);
  const imageCount = useAuiState((s) => s.composer.attachments.filter((a) => a.type === "image").length);

  const pickImages = async () => {
    if (imageCount >= MAX_IMAGES) throw new Error(`You can attach up to ${MAX_IMAGES} photos.`);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - imageCount,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      const base64 = await encodeJpeg(asset);
      if (!base64 || Math.ceil(base64.length * 3 / 4) > MAX_IMAGE_BYTES) {
        throw new Error("Photo is too large after resizing (2 MB limit).");
      }
      await aui.composer.addAttachment({
        name: `${(asset.fileName ?? "image").replace(/\.[^.]+$/, "")}.jpg`,
        contentType: "image/jpeg",
        type: "image",
        content: [{ type: "image", image: `data:image/jpeg;base64,${base64}` }],
      });
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/plain", "text/markdown"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (/\.pdf$/i.test(asset.name) || asset.mimeType === "application/pdf") {
      const summary = await uploadPdfAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: "application/pdf",
        size: asset.size,
      });
      await aui.composer.addAttachment({
        name: asset.name,
        contentType: "application/pdf",
        type: "document",
        content: [{ type: "text", text: summary }],
      });
      return;
    }
    if (!/\.(txt|md)$/i.test(asset.name) && !asset.mimeType?.startsWith("text/")) {
      throw new Error("Choose a PDF, TXT, or Markdown file.");
    }
    const file = new File(asset.uri);
    if ((asset.size ?? file.size) > MAX_TEXT_BYTES) {
      throw new Error("Text files must be 16 KB or smaller.");
    }
    const text = await file.text();
    if (text.length > MAX_TEXT_BYTES) throw new Error("Text file is too large.");
    await aui.composer.addAttachment({
      name: asset.name,
      contentType: asset.mimeType ?? "text/plain",
      type: "document",
      content: [{ type: "text", text: `[Attached text file: ${asset.name}]\n${text}` }],
    });
  };

  const pasteText = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) throw new Error("The clipboard has no text to attach.");
    if (text.length > MAX_PASTE_CHARS) {
      throw new Error("Pasted text is too large (64,000 characters). Split it into parts.");
    }
    await aui.composer.addAttachment({
      name: `Pasted text · ${text.length.toLocaleString("en-US")} characters`,
      contentType: "text/plain",
      type: "document",
      content: [{ type: "text", text: `[Pasted text]\n${text}` }],
    });
  };

  const runPicker = (picker: () => Promise<void>) => {
    if (preparing || !canAttach) return;
    onPreparingChange(true);
    void picker().catch((cause) => {
      Alert.alert("Could not attach file", cause instanceof Error ? cause.message : "Try again.");
    }).finally(() => onPreparingChange(false));
  };

  return (
    <AttachmentMenu
      disabled={preparing || !canAttach}
      onChoosePhoto={() => runPicker(pickImages)}
      onChooseFile={() => runPicker(pickFile)}
      onPasteText={() => runPicker(pasteText)}
    />
  );
};

const UserMessageAttachment: FC = () => {
  const uri = useAttachmentImageUri();
  if (!uri) return <AttachmentName />;

  return (
    <Image
      source={{ uri }}
      className="aui-user-message-attachment-image bg-muted size-[200px] rounded-2xl"
      resizeMode="cover"
    />
  );
};

export const UserMessageAttachments: FC = () => (
  <AuiIf
    condition={(s) =>
      ((s.message.submission?.attachments ?? s.message.attachments)?.length ??
        0) > 0
    }
  >
    <View className="aui-user-message-attachments flex-row flex-wrap justify-end gap-1.5">
      <MessagePrimitive.Attachments>
        {() => <UserMessageAttachment />}
      </MessagePrimitive.Attachments>
    </View>
  </AuiIf>
);
