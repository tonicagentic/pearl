import { useCallback, useRef, useState, type ComponentRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { useCSSVariable } from "uniwind";

import { PearlIntroGraphic } from "@/components/intro/pearl-intro-graphic";
import { PEARL_INTRO_PANELS } from "@/components/intro/pearl-intro-panels";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/**
 * Full-bleed horizontal intro pager: graphic collage on top, short copy below,
 * page dots, and a primary CTA (Next / continue) with optional Self-host.
 */
export function PearlIntroPager({
  onContinueWithHost,
  onSelfHost,
  continueLabel = "Get started",
  compact = false,
}: {
  readonly onContinueWithHost: () => void;
  /** Omitted on locked TestFlight builds that only talk to the host. */
  readonly onSelfHost?: () => void;
  /** Last-slide primary label (signed-out vs About). */
  readonly continueLabel?: string;
  /** Slightly tighter spacing for form sheets. */
  readonly compact?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(windowWidth);
  const [index, setIndex] = useState(0);
  const pagerRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const dotActive = useCSSVariable("--color-foreground") as string | undefined;
  const dotIdle = useCSSVariable("--color-border") as string | undefined;

  const lastIndex = PEARL_INTRO_PANELS.length - 1;
  const onLast = index >= lastIndex;

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(pageWidth, 1));
      if (next !== index) {
        setIndex(Math.max(0, Math.min(lastIndex, next)));
      }
    },
    [index, lastIndex, pageWidth],
  );

  const goNext = useCallback(() => {
    if (onLast) {
      onContinueWithHost();
      return;
    }
    const nextIndex = Math.min(lastIndex, index + 1);
    pagerRef.current?.scrollTo({
      x: nextIndex * pageWidth,
      animated: true,
    });
    setIndex(nextIndex);
  }, [index, lastIndex, onContinueWithHost, onLast, pageWidth]);

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - pageWidth) > 0.5) {
          setPageWidth(next);
        }
      }}
    >
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {PEARL_INTRO_PANELS.map((panel) => (
          <View key={panel.id} style={[styles.page, { width: pageWidth }]}>
            <View
              style={[styles.graphic, compact ? styles.graphicCompact : null]}
            >
              <PearlIntroGraphic panelId={panel.id} />
            </View>
            <View style={styles.copy}>
              <Text
                variant={compact ? "title" : "display"}
                className={
                  compact
                    ? "text-center tracking-tight leading-7"
                    : "text-center tracking-tight leading-8"
                }
              >
                {panel.title}
              </Text>
              <Text
                variant="body"
                tone="muted"
                className="text-center leading-[23px]"
              >
                {panel.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PEARL_INTRO_PANELS.map((panel, i) => (
            <View
              key={panel.id}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === index ? (dotActive ?? "#111") : (dotIdle ?? "#ccc"),
                  opacity: i === index ? 1 : 0.55,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.ctaStack}>
          <Button
            label={onLast ? continueLabel : "Next"}
            onPress={goNext}
          />
          {onLast && onSelfHost ? (
            <Button
              label="Self-host"
              variant="secondary"
              onPress={onSelfHost}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 24,
  },
  graphic: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 220,
    marginTop: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  graphicCompact: {
    minHeight: 180,
    marginTop: 0,
  },
  copy: {
    gap: 10,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 14,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  ctaStack: {
    gap: 10,
  },
});
