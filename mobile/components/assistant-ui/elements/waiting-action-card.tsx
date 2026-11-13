import {
  QuestionsCard,
  type QuestionsWaitingAction,
  type WaitingQuestionItem,
} from "@/components/assistant-ui/elements/questions-card";
import {
  inkButton,
  useAnnounce,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";
import { type FC, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export type { QuestionsWaitingAction, WaitingQuestionItem };

export type WaitingActionOption = {
  readonly id: string;
  readonly label: string;
};

/** Authorization or Allow/Deny approval — questions use `kind: "questions"`. */
export type WaitingAction =
  | {
      readonly kind: "authorization";
      readonly title: string;
      readonly detail?: string;
      readonly prompt?: string;
    }
  | {
      readonly kind: "approval";
      readonly title: string;
      readonly detail?: string;
      readonly prompt?: string;
      readonly options?: readonly WaitingActionOption[];
      readonly onRespond?: (response: {
        readonly optionId?: string;
        readonly text?: string;
      }) => void | Promise<void>;
    }
  | QuestionsWaitingAction;

type MotionBoxProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly entering?: object;
  readonly accessibilityRole?: "alert";
  readonly accessibilityLabel?: string;
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
 * HITL response surface inside the composer shell (or a standalone card).
 * Questions use the lettered multi-ask card; approvals keep Allow/Deny pills.
 */
export const WaitingActionCard: FC<{
  readonly action: WaitingAction;
  readonly variant?: "composer" | "card";
}> = ({ action, variant = "composer" }) => {
  if (action.kind === "questions") {
    return <QuestionsCard action={action} variant={variant} />;
  }

  return <ApprovalOrAuthCard action={action} variant={variant} />;
};

const ApprovalOrAuthCard: FC<{
  readonly action: Exclude<WaitingAction, QuestionsWaitingAction>;
  readonly variant: "composer" | "card";
}> = ({ action, variant }) => {
  const motion = useMotion();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useAnnounce(error ?? undefined);

  const busy = submitting !== null;
  const showOptions =
    action.kind === "approval" &&
    action.options &&
    action.options.length > 0;

  const respond = (response: {
    readonly optionId?: string;
    readonly text?: string;
  }) => {
    if (busy || action.kind !== "approval" || !action.onRespond) return;
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

  const headline = action.prompt ?? action.title;

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
      className={cn(
        "overflow-hidden",
        variant === "card"
          ? "mb-2 rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-sm shadow-black/5"
          : undefined,
      )}
      accessibilityRole="alert"
      accessibilityLabel={headline}
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
        <Text
          className="text-foreground text-sm font-medium leading-snug"
          testID={action.prompt ? "waiting-action-prompt" : undefined}
        >
          {headline}
        </Text>
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
      {error ? (
        <Text className="text-destructive mt-2 text-xs" selectable>
          {error}
        </Text>
      ) : null}
    </MotionBox>
  );
};
