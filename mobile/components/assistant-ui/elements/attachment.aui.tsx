import { Icon } from "@/components/ui/icon";
import {
  ImageViewer,
  measureViewerOrigin,
  type ImageViewerItem,
  type ViewerOrigin,
} from "@/components/image-viewer";
import { AttachmentMenu } from "./attachment-menu";
import {
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { FileIcon, XIcon } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ElementRef,
  type FC,
} from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";

import { uploadImageAttachment } from "@/src/image-attachment";
import { shareRemoteMedia } from "@/src/media-actions";
import { seedMediaCache, useDisplayMediaUri } from "@/src/media-disk-cache";
import { uploadPdfAttachment } from "@/src/pdf-attachment";
import {
  isSupportedAttachment,
  uploadFileAttachment,
} from "@/src/file-attachment";
import {
  appendPendingAttachment,
  chatAttachmentKey,
  clearPendingAttachments,
  getPendingAttachments,
  mergePreviewUris,
  setPendingAttachments,
  type PendingAttachmentDraft,
} from "@/src/pending-attachments";
import { previewComposerAttachment } from "@/src/preview-composer-attachment";

// Match live-camera sizing so photo turns stay under the gateway body cap.
const MAX_IMAGE_EDGE = 1280;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1 * 1024 * 1024;
const JPEG_QUALITY = 0.65;

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
        compress: JPEG_QUALITY,
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

function base64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/[\t\n\f\r ]/g, "");
  const binary = globalThis.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const useAttachmentImageUri = () =>
  useAuiState((s) => {
    const part = s.attachment.content?.find((c) => c.type === "image");
    return part?.type === "image" ? part.image : undefined;
  });

const useAttachmentTextPreview = () =>
  useAuiState((s) => {
    const part = s.attachment.content?.find((c) => c.type === "text");
    return part?.type === "text" ? part.text : undefined;
  });

// Select primitives only — a fresh object from useAuiState fails React's
// getSnapshot caching check and infinite-loops (see citation.tsx).
const useAttachmentMeta = () => {
  const name = useAuiState((s) => s.attachment.name);
  const contentType = useAuiState((s) => s.attachment.contentType);
  const type = useAuiState((s) => s.attachment.type);
  return { name, contentType, type };
};

function CachedRemoteImage({
  uri,
  className,
  style,
  resizeMode,
  accessibilityLabel,
}: {
  readonly uri: string;
  readonly className?: string;
  readonly style?: ComponentProps<typeof Image>["style"];
  readonly resizeMode?: ComponentProps<typeof Image>["resizeMode"];
  readonly accessibilityLabel?: string;
}) {
  const displayUri = useDisplayMediaUri(uri);
  return (
    <Image
      source={{ uri: displayUri }}
      className={className}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

function AttachmentPreviewSheet({
  open,
  onClose,
  name,
  contentType,
  imageUri,
  text,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly name: string;
  readonly contentType: string;
  readonly imageUri?: string;
  readonly text?: string;
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="absolute inset-0 bg-foreground/50"
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
          className="max-h-[88%] rounded-t-3xl border-t border-border/60"
        >
          <View className="items-center pt-2.5 pb-1">
            <View className="h-1 w-9 rounded-full bg-border" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-3">
            <View className="min-w-0 flex-1 pr-3">
              <Text variant="label" weight="semibold" numberOfLines={2}>
                {name}
              </Text>
              <Text variant="caption" className="mt-0.5">
                {contentType}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="min-h-9 justify-center px-1"
              onPress={onClose}
            >
              <Text variant="body" tone="muted">
                Done
              </Text>
            </Pressable>
          </View>
          <ScrollView
            className="px-5"
            contentContainerClassName="pb-6"
            bounces={false}
          >
            {imageUri ? (
              <CachedRemoteImage
                uri={imageUri}
                className="w-full rounded-2xl bg-muted"
                style={{ aspectRatio: 1, maxHeight: 420 }}
                resizeMode="contain"
                accessibilityLabel={name}
              />
            ) : (
              <View className="rounded-2xl bg-muted/40 px-4 py-4">
                <View className="mb-3 flex-row items-center gap-2">
                  <Icon as={FileIcon} className="size-5 text-foreground" />
                  <Text variant="body" weight="medium">
                    Document
                  </Text>
                </View>
                <Text selectable variant="secondary" tone="default">
                  {text?.slice(0, 8_000) || "No preview available."}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const AttachmentName: FC = () => (
  <View className="aui-attachment-file bg-muted border-border h-14 max-w-40 justify-center rounded-xl border px-3">
    <AttachmentPrimitive.Name
      className="aui-attachment-name text-foreground text-xs"
      numberOfLines={1}
    />
  </View>
);

/** Badge-only hit expansion — never cover the thumbnail preview target. */
const removeHitSlop = { top: 6, right: 6, bottom: 6, left: 6 };

const ComposerAttachment: FC<{
  conversationId?: string | null;
}> = ({ conversationId = null }) => {
  const uri = useAttachmentImageUri();
  const text = useAttachmentTextPreview();
  const meta = useAttachmentMeta();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const chatKey = chatAttachmentKey(conversationId);

  const openPreview = useCallback(() => {
    if (opening) return;
    setOpening(true);
    void (async () => {
      try {
        const pending = getPendingAttachments(chatKey).find(
          (item) =>
            item.name === meta.name &&
            item.contentType === (meta.contentType ?? "application/octet-stream"),
        );
        const opened = await previewComposerAttachment({
          name: meta.name,
          contentType: meta.contentType,
          previewUri: pending?.previewUri,
          imageUri: uri,
        });
        if (!opened) setPreviewOpen(true);
      } finally {
        setOpening(false);
      }
    })();
  }, [chatKey, meta.contentType, meta.name, opening, uri]);

  return (
    <AttachmentPrimitive.Root className="aui-composer-attachment-root relative">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${meta.name}`}
        disabled={opening}
        onPress={openPreview}
      >
        {uri ? (
          <CachedRemoteImage
            uri={uri}
            className="aui-composer-attachment-image bg-muted size-14 rounded-xl"
            resizeMode="cover"
          />
        ) : (
          <AttachmentName />
        )}
      </Pressable>
      <AttachmentPrimitive.Remove
        className="aui-composer-attachment-remove bg-foreground absolute -top-1.5 -right-1.5 z-10 size-5 items-center justify-center rounded-full"
        hitSlop={removeHitSlop}
        accessibilityLabel="Remove attachment"
      >
        <Icon as={XIcon} className="text-background size-3" />
      </AttachmentPrimitive.Remove>
      <AttachmentPreviewSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        name={meta.name}
        contentType={meta.contentType ?? "application/octet-stream"}
        imageUri={uri}
        text={text}
      />
    </AttachmentPrimitive.Root>
  );
};

function PendingAttachmentsSync({ chatKey }: { readonly chatKey: string }) {
  const attachments = useAuiState((s) => s.composer.attachments);
  const seenComposerAttachments = useRef(false);
  useEffect(() => {
    const previous = getPendingAttachments(chatKey);
    const drafts: PendingAttachmentDraft[] = mergePreviewUris(
      previous,
      attachments.map((attachment) => ({
        name: attachment.name,
        contentType: attachment.contentType ?? "application/octet-stream",
        type: attachment.type === "image" ? "image" : "document",
        content: [
          ...(attachment.content ?? []),
        ] as PendingAttachmentDraft["content"],
      })),
    );
    if (drafts.length > 0) {
      seenComposerAttachments.current = true;
      setPendingAttachments(chatKey, drafts);
      return;
    }
    // Empty after the composer previously held attachments = user removed them.
    // Empty on first paint = remount; keep the durable store for restore.
    if (seenComposerAttachments.current) {
      clearPendingAttachments(chatKey);
    }
  }, [attachments, chatKey]);
  return null;
}

export const ComposerAttachments: FC<{
  conversationId?: string | null;
}> = ({ conversationId = null }) => {
  const chatKey = chatAttachmentKey(conversationId);
  return (
    <>
      <PendingAttachmentsSync chatKey={chatKey} />
      <AuiIf condition={(s) => s.composer.attachments.length > 0}>
        <View className="aui-composer-attachments flex-row flex-wrap gap-2 px-1 pt-1">
          <ComposerPrimitive.Attachments>
            {() => <ComposerAttachment conversationId={conversationId} />}
          </ComposerPrimitive.Attachments>
        </View>
      </AuiIf>
    </>
  );
};

export const ComposerAddAttachment: FC<{
  preparing: boolean;
  onPreparingChange: (preparing: boolean) => void;
  conversationId?: string | null;
}> = ({
  preparing,
  onPreparingChange,
  conversationId = null,
}) => {
  const aui = useAui();
  const canAttach = useAuiState((s) => s.composer.isEditing);
  const attachmentCount = useAuiState((s) => s.composer.attachments.length);
  const imageCount = useAuiState(
    (s) => s.composer.attachments.filter((a) => a.type === "image").length,
  );
  const chatKey = chatAttachmentKey(conversationId);
  const restoringRef = useRef(false);

  // Rehydrate after remounts that cleared composer state but left the store.
  useEffect(() => {
    if (attachmentCount > 0 || restoringRef.current) return;
    const pending = getPendingAttachments(chatKey);
    if (pending.length === 0) return;
    restoringRef.current = true;
    void (async () => {
      try {
        for (const draft of pending) {
          await aui.composer.addAttachment({
            name: draft.name,
            contentType: draft.contentType,
            type: draft.type,
            content: draft.content,
          });
        }
      } catch {
        // Keep the durable store; the next mount can retry.
      } finally {
        restoringRef.current = false;
      }
    })();
  }, [attachmentCount, aui, chatKey]);

  const remember = (draft: PendingAttachmentDraft) => {
    appendPendingAttachment(chatKey, draft);
  };

  const addImageAsset = async (
    asset: ImagePicker.ImagePickerAsset,
    previewUri?: string,
  ) => {
    const base64 = await encodeJpeg(asset);
    if (!base64 || Math.ceil((base64.length * 3) / 4) > MAX_IMAGE_BYTES) {
      throw new Error("Photo is too large after resizing (1 MB limit).");
    }
    const name = `${(asset.fileName ?? "photo").replace(/\.[^.]+$/, "")}.jpg`;
    const bytes = base64ToBytes(base64);
    let imageUri: string;
    try {
      imageUri = await uploadImageAttachment({
        bytes,
        name,
        mediaType: "image/jpeg",
      });
      // Seed disk before the chip mounts so later bubbles first-paint file://.
      await seedMediaCache({ url: imageUri, bytes });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      // Blob misconfig / private-store issues: still attach as a data URL so
      // vision works; keep size under the resize cap above.
      if (
        /Blob|public URL|No Blob|private store|signed URL|Photo upload/i.test(
          message,
        )
      ) {
        imageUri = `data:image/jpeg;base64,${base64}`;
      } else {
        throw cause;
      }
    }
    const draft: PendingAttachmentDraft = {
      name,
      contentType: "image/jpeg",
      type: "image",
      content: [{ type: "image", image: imageUri }],
      previewUri: previewUri ?? asset.uri,
    };
    remember(draft);
    await aui.composer.addAttachment({
      name: draft.name,
      contentType: draft.contentType,
      type: draft.type,
      content: draft.content,
    });
  };

  const takePhoto = async () => {
    if (imageCount >= MAX_IMAGES)
      throw new Error(`You can attach up to ${MAX_IMAGES} photos.`);
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Allow camera access to take a photo.");
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    await addImageAsset(asset);
  };

  const pickImages = async () => {
    if (imageCount >= MAX_IMAGES)
      throw new Error(`You can attach up to ${MAX_IMAGES} photos.`);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - imageCount,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      await addImageAsset(asset);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "text/*",
        "text/csv",
        "text/plain",
        "text/markdown",
        "application/json",
        "application/csv",
        "public.comma-separated-values-text",
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (!isSupportedAttachment(asset.name, asset.mimeType ?? undefined)) {
      throw new Error("Choose a PDF, CSV, text, Markdown, or JSON file.");
    }

    if (/\.pdf$/i.test(asset.name) || asset.mimeType === "application/pdf") {
      const summary = await uploadPdfAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/pdf",
        size: asset.size,
      });
      const draft: PendingAttachmentDraft = {
        name: asset.name,
        contentType: "application/pdf",
        type: "document",
        content: [{ type: "text", text: summary }],
        previewUri: asset.uri,
      };
      remember(draft);
      await aui.composer.addAttachment({
        name: draft.name,
        contentType: draft.contentType,
        type: draft.type,
        content: draft.content,
      });
      return;
    }

    const uploaded = await uploadFileAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      size: asset.size,
    });
    const draft: PendingAttachmentDraft = {
      name: asset.name,
      contentType: uploaded.mediaType,
      type: "document",
      content: [{ type: "text", text: uploaded.summary }],
      previewUri: asset.uri,
    };
    remember(draft);
    await aui.composer.addAttachment({
      name: draft.name,
      contentType: draft.contentType,
      type: draft.type,
      content: draft.content,
    });
  };

  const runPicker = (picker: () => Promise<void>) => {
    if (preparing || !canAttach) return;
    onPreparingChange(true);
    void picker()
      .catch((cause) => {
        Alert.alert(
          "Could not attach file",
          cause instanceof Error ? cause.message : "Try again.",
        );
      })
      .finally(() => onPreparingChange(false));
  };

  return (
    <AttachmentMenu
      disabled={preparing || !canAttach}
      onTakePhoto={() => runPicker(takePhoto)}
      onChoosePhoto={() => runPicker(pickImages)}
      onChooseFile={() => runPicker(pickFile)}
    />
  );
};

/** Clear durable pending attachments after a successful send or new chat. */
export function discardPendingAttachments(conversationId: string | null) {
  clearPendingAttachments(chatAttachmentKey(conversationId));
}

function viewerImageId(name: string, uri: string): string {
  return `${name}:${uri}`;
}

const UserMessageAttachment: FC<{
  readonly onOpenImage: (
    id: string,
    node: ElementRef<typeof View> | null,
  ) => void;
}> = ({ onOpenImage }) => {
  const uri = useAttachmentImageUri();
  const text = useAttachmentTextPreview();
  const meta = useAttachmentMeta();
  const [previewOpen, setPreviewOpen] = useState(false);
  const tileRef = useRef<ElementRef<typeof View> | null>(null);

  return (
    <>
      <View ref={tileRef}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${meta.name}`}
          onPress={() => {
            if (uri) {
              onOpenImage(viewerImageId(meta.name, uri), tileRef.current);
              return;
            }
            setPreviewOpen(true);
          }}
        >
          {uri ? (
            <CachedRemoteImage
              uri={uri}
              className="aui-user-message-attachment-image bg-muted size-[200px] rounded-2xl"
              resizeMode="cover"
            />
          ) : (
            <AttachmentName />
          )}
        </Pressable>
      </View>
      {!uri ? (
        <AttachmentPreviewSheet
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          name={meta.name}
          contentType={meta.contentType ?? "application/octet-stream"}
          text={text}
        />
      ) : null}
    </>
  );
};

export const UserMessageAttachments: FC = () => {
  const attachments = useAuiState(
    (s) => s.message.submission?.attachments ?? s.message.attachments,
  );
  const viewerImages = useMemo((): ImageViewerItem[] => {
    const items: ImageViewerItem[] = [];
    for (const attachment of attachments ?? []) {
      const part = attachment.content?.find((c) => c.type === "image");
      const uri = part?.type === "image" ? part.image : undefined;
      if (!uri) continue;
      items.push({
        id: viewerImageId(attachment.name, uri),
        uri,
        title: attachment.name,
      });
    }
    return items;
  }, [attachments]);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerOrigin, setViewerOrigin] = useState<ViewerOrigin | null>(null);

  const openImage = useCallback(
    (id: string, node: ElementRef<typeof View> | null) => {
      const index = viewerImages.findIndex((item) => item.id === id);
      if (index < 0) return;
      void (async () => {
        const origin = await measureViewerOrigin(
          node && typeof node.measureInWindow === "function" ? node : null,
        );
        setViewerOrigin(origin);
        setViewerIndex(index);
      })();
    },
    [viewerImages],
  );

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    setViewerOrigin(null);
  }, []);

  const shareImage = useCallback(async (item: ImageViewerItem) => {
    await shareRemoteMedia({ url: item.uri, filename: item.title });
  }, []);

  return (
    <AuiIf
      condition={(s) =>
        ((s.message.submission?.attachments ?? s.message.attachments)?.length ??
          0) > 0
      }
    >
      <View className="aui-user-message-attachments flex-row flex-wrap justify-end gap-1.5">
        <MessagePrimitive.Attachments>
          {() => <UserMessageAttachment onOpenImage={openImage} />}
        </MessagePrimitive.Attachments>
      </View>
      {viewerIndex != null ? (
        <ImageViewer
          images={viewerImages}
          index={viewerIndex}
          origin={viewerOrigin}
          onClose={closeViewer}
          onIndexChange={setViewerIndex}
          onShare={shareImage}
        />
      ) : null}
    </AuiIf>
  );
};
