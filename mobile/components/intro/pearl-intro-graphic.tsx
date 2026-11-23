import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react-native";
import type { Spec } from "@json-render/core";
import { CheckIcon } from "lucide-react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import type {
  PearlIntroCard,
  PearlIntroPanelId,
  PearlIntroTask,
  PearlIntroTurn,
} from "@/components/intro/pearl-intro-panels";
import { PEARL_INTRO_PANELS } from "@/components/intro/pearl-intro-panels";
import { chatRegistry } from "@/components/json-render/registry";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/** Slow fade-up so each beat reads like a live send. */
const INTRO_ENTER_MS = 480;
const INTRO_ENTER_Y = 12;
const STEP_MS = 1400;
const START_MS = 500;
const HOLD_MS = 3400;
const LOOP_GAP_MS = 500;

const STREAM_EASE = Easing.bezier(0.22, 1, 0.36, 1);

const introEnter = FadeInDown.duration(INTRO_ENTER_MS)
  .easing(STREAM_EASE)
  .withInitialValues({
    opacity: 0,
    transform: [{ translateY: INTRO_ENTER_Y }],
  });

/**
 * Animated chat-thread preview — user message, card reply, follow-up, reply.
 * Plays only while `active` so off-screen slides stay quiet.
 */
export function PearlIntroGraphic({
  panelId,
  active,
}: {
  readonly panelId: PearlIntroPanelId;
  readonly active: boolean;
}) {
  const panel = PEARL_INTRO_PANELS.find((entry) => entry.id === panelId);
  const [visibleCount, setVisibleCount] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!panel || !active) {
      setVisibleCount(0);
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const turns = panel.turns.length;

    const clear = () => {
      if (timeout !== undefined) clearTimeout(timeout);
    };

    const play = () => {
      if (cancelled) return;
      setVisibleCount(0);
      setCycle((value) => value + 1);
      let step = 0;

      const advance = () => {
        if (cancelled) return;
        if (step < turns) {
          step += 1;
          setVisibleCount(step);
          timeout = setTimeout(advance, STEP_MS);
          return;
        }
        timeout = setTimeout(() => {
          if (cancelled) return;
          timeout = setTimeout(play, LOOP_GAP_MS);
        }, HOLD_MS);
      };

      timeout = setTimeout(advance, START_MS);
    };

    play();
    return () => {
      cancelled = true;
      clear();
    };
  }, [active, panel]);

  if (!panel) return null;

  const shown = panel.turns.slice(0, visibleCount);

  return (
    <View className="flex-1 justify-center gap-3 px-1" pointerEvents="none">
      {shown.map((turn, index) => (
        <Animated.View
          key={`${panelId}-${cycle}-${index}`}
          entering={introEnter}
        >
          <TurnView turn={turn} />
        </Animated.View>
      ))}
    </View>
  );
}

function TurnView({ turn }: { readonly turn: PearlIntroTurn }) {
  if (turn.role === "user") {
    return (
      <View className="items-end">
        <View className="bg-muted max-w-[85%] rounded-2xl px-4 py-2">
          <Text variant="secondary" weight="medium" className="leading-[18px]">
            {turn.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-col gap-2 pr-6">
      <Text variant="secondary" className="leading-[18px]">
        {turn.text}
      </Text>
      {turn.card ? <IntroCard card={turn.card} /> : null}
    </View>
  );
}

function IntroCard({ card }: { readonly card: PearlIntroCard }) {
  if (card.kind === "spec") {
    return <IntroSpecCard spec={card.spec} />;
  }
  return <IntroTaskList tasks={card.tasks} />;
}

function IntroSpecCard({ spec }: { readonly spec: Spec }) {
  const handlers = useMemo(
    () => ({
      reply: async () => undefined,
    }),
    [],
  );

  return (
    <View className="max-w-full overflow-hidden">
      <StateProvider initialState={spec.state ?? {}}>
        <VisibilityProvider>
          <ActionProvider handlers={handlers}>
            <Renderer
              spec={spec}
              registry={chatRegistry}
              includeStandard={false}
              loading={false}
              fallback={() => null}
            />
          </ActionProvider>
        </VisibilityProvider>
      </StateProvider>
    </View>
  );
}

function IntroTaskList({ tasks }: { readonly tasks: readonly PearlIntroTask[] }) {
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const mutedColor = useCSSVariable("--color-muted") as string | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;

  return (
    <View className="flex-col gap-2">
      {tasks.map((task) => (
        <View
          key={task.verb + task.rest}
          className="flex-row items-center gap-2.5 rounded-full border px-3 py-2"
          style={{
            backgroundColor: cardColor,
            borderColor: borderColor ?? "transparent",
          }}
        >
          <View
            className="size-6 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: primaryColor }}
          >
            <Icon
              as={CheckIcon}
              className="size-3.5"
              style={
                primaryForeground ? { color: primaryForeground } : undefined
              }
            />
          </View>
          <View
            className="shrink-0 rounded-md border px-2 py-0.5"
            style={{
              backgroundColor: mutedColor,
              borderColor: borderColor ?? "transparent",
            }}
          >
            <Text
              variant="caption"
              weight="semibold"
              style={foregroundColor ? { color: foregroundColor } : undefined}
            >
              {task.verb}
            </Text>
          </View>
          <Text
            variant="secondary"
            className="min-w-0 flex-1 leading-snug"
            numberOfLines={2}
          >
            {task.rest}
          </Text>
        </View>
      ))}
    </View>
  );
}
