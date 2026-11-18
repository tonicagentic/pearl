import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  downloadRemoteMedia,
  previewRemoteMedia,
  shareRemoteMedia,
} from "@/src/media-actions";
import { useDisplayMediaUri } from "@/src/media-disk-cache";
import type { ImageMessagePartComponent } from "@assistant-ui/react-native";
import {
  DownloadIcon,
  ImageIcon,
  ImageOffIcon,
  ShareIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react-native";
import { memo, type PropsWithChildren, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image as NativeImage,
  Modal,
  Pressable,
  Text,
  View,
  type ImageLoadEvent,
  type ImageProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "./icon-button";
import { paper, usePulse } from "./surfaces";

export type ImageRootProps = ViewProps;

function ImageRoot({ className, children, ...props }: ImageRootProps) {
  return (
    <View
      className={cn(
        "aui-image-root",
        paper,
        "overflow-hidden rounded-xl",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

type ImagePreviewProps = Omit<ImageProps, "source" | "style"> & {
  src: string;
  alt?: string;
  containerClassName?: string;
  /** Stable disk-cache key (prefer Blob pathname over signed URL). */
  cacheKey?: string;
};

function ImagePreview({
  alt = "Image content",
  cacheKey,
  className,
  containerClassName,
  onError,
  onLoad,
  src,
  ...props
}: ImagePreviewProps) {
  const displaySrc = useDisplayMediaUri(src, cacheKey);
  const [aspectRatio, setAspectRatio] = useState<
    { src: string; value: number } | undefined
  >(undefined);
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const [errorSrc, setErrorSrc] = useState<string | undefined>(undefined);
  const loaded = loadedSrc === displaySrc;
  const error = errorSrc === displaySrc;
  const currentAspectRatio =
    aspectRatio?.src === displaySrc ? aspectRatio.value : undefined;
  const opacity = usePulse(!loaded && !error);

  const applyNaturalSize = (width: number, height: number) => {
    if (!(width > 0 && height > 0)) return;
    const value = width / height;
    setAspectRatio((current) =>
      current?.src === displaySrc && current.value === value
        ? current
        : { src: displaySrc, value },
    );
  };

  if (error) {
    return (
      <View
        className={cn(
          "aui-image-preview-error bg-muted min-h-32 items-center justify-center p-4",
          containerClassName,
        )}
      >
        <Icon as={ImageOffIcon} className="text-muted-foreground size-8" />
      </View>
    );
  }

  return (
    <View
      className={cn(
        "aui-image-preview relative min-h-32 w-full",
        containerClassName,
      )}
    >
      {!loaded && (
        <View className="bg-muted/50 absolute inset-0 items-center justify-center">
          <Animated.View style={{ opacity }}>
            <Icon as={ImageIcon} className="text-muted-foreground size-8" />
          </Animated.View>
        </View>
      )}
      <NativeImage
        source={{ uri: displaySrc }}
        accessibilityLabel={alt}
        resizeMode="contain"
        className={cn("w-full", !loaded && "opacity-0", className)}
        style={
          currentAspectRatio === undefined
            ? undefined
            : { aspectRatio: currentAspectRatio }
        }
        onLoad={(event) => {
          // react-native-web forwards the bare DOM load event, which carries no source and whose target is already null by the time the decoded image reports.
          const { source } = event.nativeEvent as Partial<
            ImageLoadEvent["nativeEvent"]
          >;
          if (source) {
            applyNaturalSize(source.width, source.height);
          } else {
            NativeImage.getSize(displaySrc, applyNaturalSize);
          }
          setLoadedSrc(displaySrc);
          onLoad?.(event);
        }}
        onError={(event) => {
          setErrorSrc(displaySrc);
          onError?.(event);
        }}
        {...props}
      />
    </View>
  );
}

function ImageFilename({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Text>) {
  if (!children) return null;

  return (
    <Text
      className={cn(
        "aui-image-filename text-muted-foreground px-2 py-1.5 text-xs",
        className,
      )}
      numberOfLines={1}
      {...props}
    >
      {children}
    </Text>
  );
}

type ImageZoomProps = PropsWithChildren<{
  src: string;
  alt?: string;
  cacheKey?: string;
  filename?: string;
}>;

function ImageZoom({
  src,
  alt = "Image preview",
  cacheKey,
  filename,
  children,
}: ImageZoomProps) {
  const displaySrc = useDisplayMediaUri(src, cacheKey);
  const [isOpen, setIsOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const close = () => setIsOpen(false);

  const openPreview = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const opened = await previewRemoteMedia({
        url: src,
        cacheKey,
        filename: filename || alt || "image.jpg",
      });
      if (!opened) setIsOpen(true);
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <Pressable
        className="aui-image-zoom-trigger"
        accessibilityRole="imagebutton"
        accessibilityLabel="Preview image"
        disabled={opening}
        onPress={() => {
          void openPreview();
        }}
      >
        {children}
      </Pressable>
      <Modal
        transparent
        visible={isOpen}
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          className="aui-image-zoom-overlay flex-1 items-center justify-center bg-black/80 p-4"
          accessibilityLabel="Zoomed image"
          onPress={close}
        >
          <NativeImage
            source={{ uri: displaySrc }}
            accessibilityLabel={alt}
            resizeMode="contain"
            className="aui-image-zoom-content h-full w-full"
          />
          <SafeAreaView edges={["top"]} className="absolute top-0 right-0 p-4">
            <IconButton label="Close zoomed image" onPress={close}>
              <Icon as={XIcon} className="text-background size-5" />
            </IconButton>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </>
  );
}

type ImageActionsProps = {
  readonly src: string;
  readonly filename?: string;
  readonly cacheKey?: string;
  readonly className?: string;
};

function ImageActions({
  src,
  filename = "image.jpg",
  cacheKey,
  className,
}: ImageActionsProps) {
  const [busy, setBusy] = useState<"share" | "download" | null>(null);

  const run = async (kind: "share" | "download") => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "share") {
        await shareRemoteMedia({ url: src, cacheKey, filename });
      } else {
        await downloadRemoteMedia({ url: src, cacheKey, filename });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      className={cn(
        "aui-image-actions flex-row items-center gap-1 px-1 pb-1",
        className,
      )}
    >
      <IconButton
        label="Download image"
        disabled={busy !== null}
        className="size-9"
        style={{ opacity: busy !== null ? 0.4 : 1 }}
        onPress={() => {
          void run("download");
        }}
      >
        <Icon
          as={DownloadIcon}
          className={cn(
            "text-muted-foreground size-4",
            busy === "download" && "opacity-50",
          )}
        />
      </IconButton>
      <IconButton
        label="Share image"
        disabled={busy !== null}
        className="size-9"
        style={{ opacity: busy !== null ? 0.4 : 1 }}
        onPress={() => {
          void run("share");
        }}
      >
        <Icon
          as={ShareIcon}
          className={cn(
            "text-muted-foreground size-4",
            busy === "share" && "opacity-50",
          )}
        />
      </IconButton>
    </View>
  );
}

function ImageGenerating({ className }: { className?: string }) {
  return (
    <View
      className={cn(
        "aui-image-generating bg-muted/50 min-h-32 items-center justify-center p-4",
        className,
      )}
      accessibilityRole="progressbar"
      accessibilityLabel="Generating image"
    >
      <ActivityIndicator />
    </View>
  );
}

function ImageContentFilterError({
  className,
  reason,
}: {
  className?: string;
  reason?: string;
}) {
  return (
    <View
      className={cn(
        "aui-image-content-filter-error bg-muted/50 min-h-32 items-center justify-center gap-2 p-4",
        className,
      )}
    >
      <Icon as={ShieldAlertIcon} className="text-muted-foreground size-8" />
      <Text className="text-foreground text-sm font-medium">
        Image could not be generated
      </Text>
      {reason && (
        <Text className="text-muted-foreground text-center text-xs">
          {reason}
        </Text>
      )}
    </View>
  );
}

const ImageImpl: ImageMessagePartComponent = ({ image, filename, status }) => {
  if (status?.type === "running") {
    return (
      <ImageRoot>
        <ImageGenerating />
        <ImageFilename>{filename}</ImageFilename>
      </ImageRoot>
    );
  }

  if (status?.type === "incomplete" && status.reason === "content-filter") {
    return (
      <ImageRoot>
        <ImageContentFilterError reason="The provider blocked this image." />
      </ImageRoot>
    );
  }

  return (
    <ImageRoot>
      <ImageZoom
        src={image}
        alt={filename || "Image content"}
        filename={filename || "image.jpg"}
      >
        <ImagePreview src={image} alt={filename || "Image content"} />
      </ImageZoom>
      <View className="flex-row items-center justify-between gap-1">
        <ImageFilename className="min-w-0 flex-1">{filename}</ImageFilename>
        <ImageActions src={image} filename={filename || "image.jpg"} />
      </View>
    </ImageRoot>
  );
};

const Image = memo(ImageImpl) as unknown as ImageMessagePartComponent & {
  Root: typeof ImageRoot;
  Preview: typeof ImagePreview;
  Filename: typeof ImageFilename;
  Zoom: typeof ImageZoom;
  Actions: typeof ImageActions;
  Generating: typeof ImageGenerating;
  ContentFilterError: typeof ImageContentFilterError;
};

Image.displayName = "Image";
Image.Root = ImageRoot;
Image.Preview = ImagePreview;
Image.Filename = ImageFilename;
Image.Zoom = ImageZoom;
Image.Actions = ImageActions;
Image.Generating = ImageGenerating;
Image.ContentFilterError = ImageContentFilterError;

export {
  Image,
  ImageRoot,
  ImagePreview,
  ImageFilename,
  ImageZoom,
  ImageActions,
  ImageGenerating,
  ImageContentFilterError,
};
