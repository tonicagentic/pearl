import {
  inkButton,
  useAnnounce,
  useMotion,
} from "@/components/assistant-ui/elements/surfaces";
import { cn } from "@/lib/utils";
import {
  type ElementRef,
  type FC,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

/** Synthetic choice that expands into a free-text field over the options. */
export const FREEFORM_OPTION_ID = "__freeform__";

export type WaitingQuestionItem = {
  readonly id: string;
  readonly prompt: string;
  readonly detail?: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly allowFreeform: boolean;
  readonly dismissible?: boolean;
  readonly skipOptionId?: string;
};

export type QuestionsWaitingAction = {
  readonly kind: "questions";
  readonly items: readonly WaitingQuestionItem[];
  readonly onRespond: (response: {
    readonly interactionId: string;
    readonly optionId?: string;
    readonly text?: string;
  }) => void | Promise<void>;
  readonly onSkip?: (itemId: string) => void | Promise<void>;
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

type MotionBoxProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly entering?: object;
  readonly accessibilityRole?: "alert";
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

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

type QuestionDraft = {
  readonly optionId?: string;
  readonly text?: string;
  readonly skipped?: boolean;
  readonly submitted?: boolean;
};

/**
 * Cursor-style Questions surface for one to three open parks: lettered
 * options, select-then-Next/Done, Skip, and Back to review earlier answers.
 */
export const QuestionsCard: FC<{
  readonly action: QuestionsWaitingAction;
  readonly variant?: "composer" | "card";
}> = ({ action, variant = "composer" }) => {
  const motion = useMotion();
  const items = action.items.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, QuestionDraft>>({});
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerInputRef = useRef<ElementRef<typeof TextInput>>(null);
  useAnnounce(error ?? undefined);

  const safeIndex = Math.min(index, Math.max(0, items.length - 1));
  const item = items[safeIndex];
  const multi = items.length > 1;
  const last = safeIndex >= items.length - 1;
  const showQuestionBack = multi && safeIndex > 0;
  const hasOptions = Boolean(item?.options.length);
  // Options + freeform: "Something else…" expands into the field. Text-only:
  // the field is the whole answer surface.
  const offerFreeformChoice = Boolean(
    item?.allowFreeform && item.options.length > 0,
  );
  const textOnly = Boolean(item && !item.options.length);
  const freeformOpen =
    textOnly || selectedOptionId === FREEFORM_OPTION_ID;
  const choiceOptions = item
    ? offerFreeformChoice
      ? [
          ...item.options,
          { id: FREEFORM_OPTION_ID, label: "Something else…" },
        ]
      : item.options
    : [];
  const showSkip =
    Boolean(item) &&
    (multi || item!.dismissible === true || item!.skipOptionId != null);
  const canSubmit =
    Boolean(item) &&
    !submitting &&
    (freeformOpen
      ? answer.trim().length > 0
      : selectedOptionId != null &&
        selectedOptionId !== FREEFORM_OPTION_ID);

  useEffect(() => {
    setIndex((current) =>
      items.length === 0 ? 0 : Math.min(current, items.length - 1),
    );
  }, [items.length]);

  const draftForItem = item ? drafts[item.id] : undefined;
  useEffect(() => {
    if (draftForItem?.text && !draftForItem.optionId) {
      setSelectedOptionId(FREEFORM_OPTION_ID);
    } else {
      setSelectedOptionId(draftForItem?.optionId ?? null);
    }
    setAnswer(draftForItem?.text ?? "");
    setError(null);
  }, [item?.id, draftForItem]);

  useEffect(() => {
    if (!freeformOpen || textOnly) return;
    const handle = requestAnimationFrame(() => {
      answerInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [freeformOpen, textOnly, item?.id]);

  if (!item) return null;

  const run = async (work: () => void | Promise<void>) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const advance = () => {
    setIndex((current) => Math.min(current + 1, items.length - 1));
  };

  const goBack = () => {
    if (!showQuestionBack || submitting) return;
    setIndex((current) => Math.max(0, current - 1));
  };

  const closeFreeform = () => {
    if (submitting || textOnly) return;
    setSelectedOptionId(null);
    setAnswer("");
  };

  const rememberDraft = (draft: QuestionDraft) => {
    setDrafts((current) => ({ ...current, [item.id]: draft }));
  };

  const onSkip = () => {
    void run(async () => {
      const shouldDismiss = item.dismissible || item.skipOptionId != null;
      if (shouldDismiss) {
        await action.onSkip?.(item.id);
      }
      rememberDraft({
        skipped: true,
        ...(shouldDismiss ? { submitted: true } : {}),
      });
      if (multi && !last) {
        advance();
      }
    });
  };

  const onNext = () => {
    if (!canSubmit) return;
    const usingFreeform = freeformOpen;
    const optionId = usingFreeform
      ? undefined
      : (selectedOptionId ?? undefined);
    const text = usingFreeform ? answer.trim() : undefined;
    const previous = drafts[item.id];
    const unchanged =
      previous?.submitted === true &&
      previous.optionId === optionId &&
      previous.text === text &&
      !previous.skipped;
    void run(async () => {
      if (!unchanged) {
        await action.onRespond({
          interactionId: item.id,
          ...(optionId ? { optionId } : {}),
          ...(text !== undefined ? { text } : {}),
        });
      }
      rememberDraft({
        ...(optionId ? { optionId } : {}),
        ...(text !== undefined ? { text } : {}),
        submitted: true,
      });
      if (multi && !last) {
        advance();
      }
    });
  };

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
      accessibilityLabel={item.prompt}
      testID="waiting-action-card"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5">
          <View className="bg-muted size-5 items-center justify-center rounded-full">
            <Text className="text-foreground text-[10px] font-bold">?</Text>
          </View>
          <Text className="text-foreground text-sm font-semibold">
            Questions
          </Text>
        </View>
        {multi ? (
          <Text
            className="text-muted-foreground text-xs font-medium"
            testID="questions-progress"
          >
            {safeIndex + 1}/{items.length}
          </Text>
        ) : null}
      </View>

      <MotionBox
        key={item.id}
        motion={motion}
        entering={
          motion
            ? FadeInDown.delay(40).duration(220).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 6 }],
              })
            : undefined
        }
        className="mt-3 gap-1.5"
      >
        <Text
          className="text-foreground text-sm font-medium leading-snug"
          testID="waiting-action-prompt"
        >
          {item.prompt}
        </Text>
        {item.detail ? (
          <Text
            className="text-muted-foreground text-xs leading-snug"
            numberOfLines={6}
            testID="waiting-action-detail"
          >
            {item.detail}
          </Text>
        ) : null}
      </MotionBox>

      {hasOptions && !freeformOpen ? (
        <View className="mt-3 gap-1.5">
          {choiceOptions.map((option, optionIndex) => {
            const letter =
              OPTION_LETTERS[optionIndex] ?? String(optionIndex + 1);
            const selected = selectedOptionId === option.id;
            const isFreeformChoice = option.id === FREEFORM_OPTION_ID;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  setSelectedOptionId(option.id);
                  if (!isFreeformChoice) setAnswer("");
                }}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${letter}. ${option.label}`}
                testID={
                  isFreeformChoice
                    ? "waiting-action-option-freeform"
                    : `waiting-action-option-${option.id}`
                }
                className={cn(
                  "flex-row items-center gap-2.5 rounded-xl px-2.5 py-2.5 active:opacity-80 disabled:opacity-50",
                  selected
                    ? inkButton
                    : "border-border/70 bg-background border",
                )}
              >
                <View
                  className={cn(
                    "size-6 items-center justify-center rounded-full",
                    selected ? "bg-background/20" : "bg-muted",
                  )}
                >
                  <Text
                    className={cn(
                      "text-xs font-semibold",
                      selected ? "text-background" : "text-muted-foreground",
                    )}
                  >
                    {letter}
                  </Text>
                </View>
                <Text
                  className={cn(
                    "flex-1 text-sm font-medium",
                    selected ? "text-background" : "text-foreground",
                    isFreeformChoice && !selected
                      ? "text-muted-foreground"
                      : undefined,
                  )}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {freeformOpen ? (
        <View className="mt-3 gap-2">
          {offerFreeformChoice ? (
            <Pressable
              onPress={closeFreeform}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Back to choices"
              testID="waiting-action-freeform-dismiss"
              hitSlop={8}
              className="self-start active:opacity-70 disabled:opacity-50"
            >
              <Text className="text-muted-foreground text-xs font-medium">
                ← Choices
              </Text>
            </Pressable>
          ) : null}
          <TextInput
            ref={answerInputRef}
            value={answer}
            onChangeText={setAnswer}
            editable={!submitting}
            multiline
            autoFocus={!textOnly}
            textAlignVertical="top"
            accessibilityLabel={item.prompt}
            placeholder="Type your answer"
            testID="waiting-action-answer"
            className="text-foreground border-border/70 bg-background min-h-24 rounded-xl border px-2.5 py-2.5 text-sm"
          />
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center justify-between gap-2">
        {showQuestionBack ? (
          <Pressable
            onPress={goBack}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="waiting-action-back"
            className="h-9 justify-center rounded-full border border-border/70 bg-background px-4 active:opacity-80 disabled:opacity-50"
          >
            <Text className="text-foreground text-sm font-medium">Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View className="flex-row items-center gap-2">
          {showSkip ? (
            <Pressable
              onPress={onSkip}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              testID="waiting-action-skip"
              className="h-9 justify-center rounded-full border border-border/70 bg-background px-4 active:opacity-80 disabled:opacity-50"
            >
              <Text className="text-foreground text-sm font-medium">Skip</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onNext}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={last ? "Done" : "Next"}
            testID="waiting-action-send"
            className={cn(
              "h-9 justify-center rounded-full px-4 active:opacity-80 disabled:opacity-50",
              inkButton,
            )}
          >
            <Text className="text-background text-sm font-medium">
              {submitting ? "…" : last ? "Done" : "Next"}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text className="text-destructive mt-2 text-xs" selectable>
          {error}
        </Text>
      ) : null}
    </MotionBox>
  );
};
