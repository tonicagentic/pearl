import { type FC, useEffect } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
  CheckCircle2Icon,
  RefreshCwIcon,
  WifiOffIcon,
} from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export type ConnectionPhase = "online" | "dropped" | "reconnecting" | "resumed";

export type ConnectionStateProps = {
  readonly phase: ConnectionPhase;
  readonly attempt?: number;
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly className?: string;
  /** Auto-clear `resumed` back to online after this many ms (default 2000). */
  readonly resumedClearMs?: number;
  readonly onResumedClear?: () => void;
};

/**
 * Props-driven connection banner (assistant-ui connection-state anatomy).
 * `online` renders nothing.
 */
export const ConnectionState: FC<ConnectionStateProps> = ({
  phase,
  attempt,
  message,
  onRetry,
  className,
  resumedClearMs = 2_000,
  onResumedClear,
}) => {
  useEffect(() => {
    if (phase !== "resumed" || !onResumedClear) return;
    const id = setTimeout(onResumedClear, resumedClearMs);
    return () => clearTimeout(id);
  }, [phase, onResumedClear, resumedClearMs]);

  if (phase === "online") return null;

  if (phase === "reconnecting") {
    return (
      <View
        data-slot="connection-state"
        accessibilityRole="progressbar"
        className={cn(
          "border-border/60 bg-muted/40 mx-4 my-3 flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3",
          className,
        )}
      >
        <ActivityIndicator size="small" />
        <Text variant="secondary" className="flex-1">
          {message ??
            (typeof attempt === "number"
              ? `Reconnecting… (attempt ${attempt})`
              : "Reconnecting…")}
        </Text>
      </View>
    );
  }

  if (phase === "resumed") {
    return (
      <View
        data-slot="connection-state"
        accessibilityRole="text"
        className={cn(
          "border-border/60 bg-muted/40 mx-4 my-3 flex-row items-center gap-2.5 rounded-xl border px-3.5 py-3",
          className,
        )}
      >
        <Icon
          as={CheckCircle2Icon}
          className="size-4 shrink-0 text-emerald-600/80 dark:text-emerald-400/80"
        />
        <Text variant="secondary" className="flex-1">
          {message ?? "Reconnected."}
        </Text>
      </View>
    );
  }

  return (
    <View
      data-slot="connection-state"
      accessibilityRole="alert"
      className={cn(
        "border-border/60 bg-muted/40 mx-4 my-3 flex-row items-start gap-2.5 rounded-xl border px-3.5 py-3",
        className,
      )}
    >
      <Icon
        as={WifiOffIcon}
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="secondary">
          {message ??
            "Connection lost. The run kept going on the server."}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Reconnect"
            className="min-h-11 flex-row items-center gap-1.5 self-start"
          >
            <Icon as={RefreshCwIcon} className="text-foreground size-3" />
            <Text variant="secondary" weight="medium">
              Reconnect
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};
