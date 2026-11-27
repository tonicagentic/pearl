import type { ReactNode } from "react";
import { KeyRoundIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { field, inkButton, mono, paper } from "./surfaces";

export type GrantScope = "session" | "always" | "denied";

/**
 * RN port of elements/permission-grant: capability, requester, reach, and a
 * pending action row or resolved receipt badge.
 */
export function PermissionGrant({
  capability,
  requester,
  reach,
  scope,
  onGrant,
  actions,
  icon,
  className,
}: {
  readonly capability: string;
  readonly requester?: string;
  readonly reach: readonly string[];
  readonly scope: GrantScope | "pending";
  readonly onGrant?: (scope: GrantScope) => void;
  /** Replaces Deny / This session / Always while pending (e.g. OAuth continue). */
  readonly actions?: ReactNode;
  /** Brand mark; defaults to a key icon. */
  readonly icon?: ReactNode;
  readonly className?: string;
}) {
  return (
    <View
      data-slot="permission-grant"
      className={cn(
        paper,
        "w-full flex-col gap-3.5 overflow-hidden rounded-[20px] bg-card p-4 dark:bg-card",
        className,
      )}
    >
      <View className="flex-row items-start gap-2.5">
        {icon ?? (
          <KeyRoundIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            variant="secondary"
            weight="medium"
            className="text-[13px] leading-snug"
          >
            {capability}
          </Text>
          {requester ? (
            <Text variant="caption" tone="default" className="opacity-55">
              requested by {requester}
            </Text>
          ) : null}
        </View>
      </View>

      {reach.length > 0 ? (
        <View className="flex-col gap-1.5">
          <Text
            variant="caption"
            tone="default"
            className={cn(mono, "opacity-55")}
          >
            this grants
          </Text>
          {reach.map((item) => (
            <View key={item} className="flex-row items-baseline gap-2">
              <View className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/20" />
              <Text
                variant="caption"
                tone="default"
                className="min-w-0 flex-1 leading-snug opacity-60"
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        {scope === "pending" ? (
          actions !== undefined ? (
            actions
          ) : onGrant ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => onGrant("denied")}
                className="h-8 items-center justify-center rounded-full px-3 active:opacity-80"
              >
                <Text variant="caption" weight="medium" className="opacity-55">
                  Deny
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onGrant("session")}
                className="h-8 items-center justify-center rounded-full px-3 active:opacity-80"
              >
                <Text variant="caption" weight="medium" className="opacity-55">
                  This session
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onGrant("always")}
                className={cn(
                  inkButton,
                  "h-8 items-center justify-center rounded-full px-3",
                )}
              >
                <Text
                  variant="caption"
                  weight="medium"
                  className="text-background"
                >
                  Always
                </Text>
              </Pressable>
            </>
          ) : (
            <View className={cn(field, "rounded-full px-2.5 py-1.5")}>
              <Text
                variant="caption"
                tone="default"
                className={cn(mono, "opacity-55")}
              >
                pending
              </Text>
            </View>
          )
        ) : (
          <View className={cn(field, "rounded-full px-2.5 py-1.5")}>
            <Text
              variant="caption"
              tone="default"
              className={cn(mono, "opacity-55")}
            >
              {scope === "denied" ? "denied" : `granted · ${scope}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
