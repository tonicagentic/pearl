import { type FC } from "react";
import { Pressable, View } from "react-native";
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ShimmerLabel } from "./surfaces";

export type ErrorStateProps = {
  readonly title: string;
  readonly detail: string;
  readonly retrying: boolean;
  readonly onRetry?: () => void;
  readonly actionLabel?: string;
  readonly className?: string;
};

/**
 * Quiet failure banner with a retry path (assistant-ui error-state anatomy).
 * While `retrying`, swaps to a single spinning status line.
 */
export const ErrorState: FC<ErrorStateProps> = ({
  title,
  detail,
  retrying,
  onRetry,
  actionLabel = "Retry",
  className,
}) => {
  if (retrying) {
    return (
      <View
        data-slot="error-state"
        accessibilityRole="progressbar"
        accessibilityLabel="Retrying"
        className={cn(
          "mx-4 my-3 flex-row items-center gap-2.5 px-1 py-1",
          className,
        )}
      >
        <Icon
          as={RefreshCwIcon}
          className="text-foreground/45 size-3.5 shrink-0"
        />
        <ShimmerLabel variant="secondary">
          Retrying
        </ShimmerLabel>
      </View>
    );
  }

  return (
    <View
      data-slot="error-state"
      accessibilityRole="alert"
      className={cn(
        "mx-4 my-3 flex-row items-start gap-2.5 rounded-2xl bg-red-500/[0.06] px-4 py-3 dark:bg-red-500/10",
        className,
      )}
    >
      <Icon
        as={CircleAlertIcon}
        className="mt-0.5 size-4 shrink-0 text-red-500/80"
      />
      <View className="min-w-0 flex-1">
        <Text className="font-medium text-red-600 dark:text-red-400">
          {title}
        </Text>
        <Text className="mt-0.5 text-[13px] leading-snug text-red-600/60 dark:text-red-400/60">
          {detail}
        </Text>
      </View>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          className="min-h-11 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1"
        >
          <Icon as={RefreshCwIcon} className="size-3 text-red-600 dark:text-red-400" />
          <Text
            weight="medium"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};
