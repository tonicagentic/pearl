import { useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { paper } from "./surfaces";

function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

export function LinkPreview({
  href,
  title,
  description,
  image,
  siteName,
  layout = "card",
  className,
}: {
  readonly href: string;
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly siteName?: string;
  readonly layout?: "card" | "compact";
  readonly className?: string;
}) {
  const safe = isSafeHref(href);
  const host = hostOf(href);
  const label = title ?? host;
  const site = siteName ?? host;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(image) && !imageFailed;

  const open = () => {
    if (safe) void Linking.openURL(href);
  };

  return (
    <Pressable
      accessibilityRole={safe ? "link" : "summary"}
      accessibilityLabel={label}
      onPress={safe ? open : undefined}
      className={cn(paper, "w-full overflow-hidden rounded-2xl", className)}
    >
      {showImage && layout === "card" ? (
        <Image
          source={{ uri: image }}
          className="aspect-[2/1] w-full"
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View className={cn("flex-row gap-3 p-3.5", layout === "compact" && showImage && "items-start")}>
        {showImage && layout === "compact" ? (
          <Image
            source={{ uri: image }}
            className="size-16 rounded-xl"
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
        <View className="min-w-0 flex-1">
          <View className="mb-1 flex-row items-center gap-1.5">
            <View className="size-3.5 items-center justify-center rounded-sm bg-foreground/10">
              <Text variant="caption" tone="default" className="text-[9px] uppercase opacity-60">
                {site.slice(0, 1)}
              </Text>
            </View>
            <Text variant="caption" tone="default" className="opacity-45">
              {site}
            </Text>
          </View>
          <Text variant="secondary" tone="default" numberOfLines={2} className="font-medium">
            {label}
          </Text>
          {description ? (
            <Text variant="caption" tone="default" numberOfLines={2} className="mt-1 leading-relaxed opacity-55">
              {description}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
