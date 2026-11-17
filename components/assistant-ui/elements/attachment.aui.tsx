"use client";

import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useState,
  type FC,
  isValidElement,
  type MouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  XIcon,
  PlusIcon,
  FileText,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { useAttachmentSrc } from "@/hooks/use-attachment-src";
import { cn } from "@/lib/utils";

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt="Attachment preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none",
        isLoaded
          ? "aui-attachment-preview-image-loaded opacity-100"
          : "aui-attachment-preview-image-loading opacity-0",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

/** Message-only image dialog; composer opens the staged file in a new tab. */
const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger cursor-zoom-in"
        asChild
      >
        {isValidElement(children) ? (
          children
        ) : (
          <button type="button">{children}</button>
        )}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&>button]:hover:bg-foreground/80 [&_svg]:text-background p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!">
        <DialogTitle className="aui-sr-only sr-only">
          Image Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm">
          <AttachmentPreview src={src} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const src = useAttachmentSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image rounded-none object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon text-muted-foreground/80 size-6 stroke-[1.5]" />
      </AvatarFallback>
    </Avatar>
  );
};

/**
 * Object URL for any staged File (image, PDF, text). Separate from the image
 * thumb hook so non-image composer chips can still open a native browser tab.
 */
function useAttachmentFileObjectUrl(): string | undefined {
  const file = useAuiState((s) =>
    s.attachment.file instanceof File ? s.attachment.file : undefined,
  );
  const [entry, setEntry] = useState<{ file: File; url: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntry(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setEntry({ file, url: objectUrl });
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return entry !== undefined && entry.file === file ? entry.url : undefined;
}

function useComposerPreviewUrl(): string | undefined {
  const objectUrl = useAttachmentFileObjectUrl();
  const imageSrc = useAttachmentSrc();
  return objectUrl ?? imageSrc;
}

const ComposerAttachmentTile: FC<{
  typeLabel: string;
  isUploading: boolean;
  isError: boolean;
}> = ({ typeLabel, isUploading, isError }) => {
  const previewUrl = useComposerPreviewUrl();
  const name = useAuiState((s) => s.attachment.name);

  const openPreview = useCallback(
    (event?: MouseEvent | ReactKeyboardEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (!previewUrl) return;
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    },
    [previewUrl],
  );

  return (
    <div
      className={cn(
        "aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius,1.5rem)-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-border after:transition-colors after:ring-inset focus-visible:ring-1 active:scale-[0.96] motion-reduce:transition-none",
        isError && "after:ring-destructive/60 dark:after:ring-destructive/60",
        !previewUrl && "cursor-default",
      )}
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          openPreview(e);
        } else if (e.key === " ") {
          e.preventDefault();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " ") openPreview(e);
      }}
      aria-label={
        previewUrl
          ? `Preview ${name || typeLabel} attachment`
          : `${typeLabel} attachment${
              isError ? ", upload failed" : isUploading ? ", uploading" : ""
            }`
      }
    >
      <AttachmentThumb />
      {isUploading && (
        <div
          aria-hidden="true"
          className="aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
        >
          <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
        </div>
      )}
      {isError && (
        <div
          aria-hidden="true"
          className="aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
        >
          <AlertCircleIcon className="text-destructive size-4" />
        </div>
      )}
    </div>
  );
};

const MessageAttachmentTile: FC<{
  typeLabel: string;
  isUploading: boolean;
  isError: boolean;
}> = ({ typeLabel, isUploading, isError }) => (
  <div
    className={cn(
      "aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius,1.5rem)-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-border after:transition-colors after:ring-inset focus-visible:ring-1 active:scale-[0.96] motion-reduce:transition-none",
      isError && "after:ring-destructive/60 dark:after:ring-destructive/60",
    )}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.currentTarget.click();
      } else if (e.key === " ") {
        e.preventDefault();
      }
    }}
    onKeyUp={(e) => {
      if (e.key === " ") e.currentTarget.click();
    }}
    aria-label={`${typeLabel} attachment${
      isError ? ", upload failed" : isUploading ? ", uploading" : ""
    }`}
  >
    <AttachmentThumb />
    {isUploading && (
      <div
        aria-hidden="true"
        className="aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
      >
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
      </div>
    )}
    {isError && (
      <div
        aria-hidden="true"
        className="aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none"
      >
        <AlertCircleIcon className="text-destructive size-4" />
      </div>
    )}
  </div>
);

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return type;
    }
  });

  const uploadState = useAuiState((s) =>
    s.attachment.status.type === "running"
      ? "uploading"
      : s.attachment.status.type === "incomplete" &&
          s.attachment.status.reason === "error"
        ? "error"
        : undefined,
  );
  const isUploading = uploadState === "uploading";
  const isError = uploadState === "error";

  const errorMessage = useAuiState((s) =>
    s.attachment.status.type === "incomplete" &&
    s.attachment.status.reason === "error"
      ? (s.attachment.status.message ?? "Upload failed")
      : undefined,
  );

  const tile = isComposer ? (
    <ComposerAttachmentTile
      typeLabel={typeLabel}
      isUploading={isUploading}
      isError={isError}
    />
  ) : (
    <MessageAttachmentTile
      typeLabel={typeLabel}
      isUploading={isUploading}
      isError={isError}
    />
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root
          className={cn(
            "aui-attachment-root relative",
            isComposer &&
              "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
            isImage &&
              !isComposer &&
              "aui-attachment-root-message only:*:first:size-24",
          )}
        >
          {isComposer ? (
            <TooltipTrigger asChild>{tile}</TooltipTrigger>
          ) : (
            <AttachmentPreviewDialog>
              <TooltipTrigger asChild>{tile}</TooltipTrigger>
            </AttachmentPreviewDialog>
          )}
          {isComposer && <AttachmentRemove />}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
          {errorMessage && (
            <p className="aui-attachment-error-message">{errorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        // Sit outside the tile (no expanded hit area over the thumbnail) so
        // preview clicks never remove the attachment.
        className="aui-attachment-tile-remove absolute -end-1.5 -top-1.5 z-10 size-5 rounded-full bg-foreground text-background hover:bg-foreground/90 hover:text-background active:scale-[0.96] motion-reduce:transition-none"
        side="top"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <XIcon className="aui-attachment-remove-icon size-3 stroke-[2.5]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        tooltip="Add Attachment"
        side="bottom"
        variant="ghost"
        size="icon"
        className="aui-composer-add-attachment text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full active:scale-[0.96] motion-reduce:transition-none"
        aria-label="Add Attachment"
      >
        <PlusIcon className="aui-attachment-add-icon size-4" />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
