import {
  inkButton,
  useAnnounce,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";
import { type FC, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export type WaitingAction = {
  readonly kind: "authorization" | "approval" | "question";
  readonly title: string;
  readonly detail?: string;
  readonly prompt?: string;
  readonly options?: readonly { readonly id: string; readonly label: string }[];
  readonly allowFreeform?: boolean;
  readonly onRespond?: (response: {
    readonly optionId?: string;
    readonly text?: string;
  }) => void | Promise<void>;
};

type MotionBoxProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly entering?: object;
  readonly accessibilityRole?: "alert";
  readonly testID?: string;
};

/** Animated when motion is on; plain View otherwise (and in tests). */
const MotionBox: FC<MotionBoxProps & { readonly motion: boolean }> = ({
  motion,
  children,
  entering,
  ...rest
}) => {
  if (!motion) {
    return <View {...rest}>{children}</View>;
  }
  return (
    <Animated.View entering={entering as never} {...rest}>
      {children}
    </Animated.View>
  );
};

/**
 * Composer HITL card: authorization banner, approval buttons, choice
 * questions, or a free-text answer field.
 */
export const WaitingActionCard: FC<{
  readonly action: WaitingAction;
}> = ({ action }) => {
  const motion = useMotion();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  useAnnounce(error ?? undefined);

  const busy = submitting !== null;
  const showOptions =
    (action.kind === "approval" || action.kind === "question") &&
    action.options &&
    action.options.length > 0;
  const showTextField =
    action.kind === "question" &&
    (action.allowFreeform === true || !showOptions);

  const respond = (response: {
    readonly optionId?: string;
    readonly text?: string;
  }) => {
    if (busy || !action.onRespond) return;
    setSubmitting(response.optionId ?? "text");
    setError(null);
    void (async () => {
      try {
        await action.onRespond!(response);
      } catch (cause) {
        setSubmitting(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
  };

  const waitingLabel =
    action.kind === "question"
      ? "Waiting for your answer. "
      : "Waiting for your confirmation. ";

  return (
    <MotionBox
      motion={motion}
      entering={
        motion
          ? FadeInDown.springify(260)
              .damping(26)
              .stiffness(240)
              .withInitialValues({
                opacity: 0,
                transform: [{ translateY: 18 }],
              })
          : undefined
      }
      className="mb-2 overflow-hidden rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-sm shadow-black/5"
      accessibilityRole="alert"
      testID="waiting-action-card"
    >
      <MotionBox
        motion={motion}
        entering={
          motion
            ? FadeInDown.delay(40).duration(220).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 6 }],
              })
            : undefined
        }
        className="gap-1.5"
      >
        <Text className="text-muted-foreground text-sm">
          <Text className="text-foreground font-medium">{waitingLabel}</Text>
          {action.title}
        </Text>
        {action.prompt ? (
          <Text
            className="text-foreground text-sm font-medium leading-snug"
            testID="waiting-action-prompt"
          >
            {action.prompt}
          </Text>
        ) : null}
        {action.detail ? (
          <Text
            className="text-muted-foreground text-xs leading-snug"
            numberOfLines={6}
            testID="waiting-action-detail"
          >
            {action.detail}
          </Text>
        ) : null}
      </MotionBox>
      {showOptions ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          {action.options!.map((option, index) => {
            const primary = index === 0;
            return (
              <MotionBox
                key={option.id}
                motion={motion}
                entering={
                  motion
                    ? FadeInDown.delay(90 + index * 45)
                        .springify(220)
                        .damping(28)
                        .stiffness(280)
                        .withInitialValues({
                          opacity: 0,
                          transform: [{ translateY: 10 }],
                        })
                    : undefined
                }
              >
                <Pressable
                  onPress={() => respond({ optionId: option.id })}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  testID={`waiting-action-option-${option.id}`}
                  className={cn(
                    "h-9 justify-center rounded-full px-4 active:opacity-80 disabled:opacity-50",
                    primary
                      ? inkButton
                      : "border-border/70 bg-background border",
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      primary ? "text-background" : "text-foreground",
                    )}
                  >
                    {submitting === option.id ? "…" : option.label}
                  </Text>
                </Pressable>
              </MotionBox>
            );
          })}
        </View>
      ) : null}
      {showTextField ? (
        <View className="mt-3 gap-2">
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            editable={!busy}
            multiline
            textAlignVertical="top"
            accessibilityLabel={action.prompt ?? "Answer"}
            placeholder="Type your answer"
            testID="waiting-action-answer"
            className="text-foreground border-border/70 bg-background min-h-16 rounded-lg border px-2.5 py-2 text-sm"
          />
          <View className="flex-row flex-wrap items-center gap-2">
            <Pressable
              onPress={() => respond({ text: answer })}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Send"
              testID="waiting-action-send"
              className={cn(
                "h-9 justify-center rounded-full px-4 active:opacity-80 disabled:opacity-50",
                inkButton,
              )}
            >
              <Text className="text-background text-sm font-medium">
                {submitting === "text" ? "…" : "Send"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {error ? (
        <Text className="text-destructive mt-2 text-xs" selectable>
          {error}
        </Text>
      ) : null}
    </MotionBox>
  );
};
