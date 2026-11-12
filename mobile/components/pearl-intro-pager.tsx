import { useCallback, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

import { PearlIntroGraphic } from "@/components/pearl-intro-graphic";
import { PEARL_INTRO_PANELS } from "@/components/pearl-intro-panels";
import { Button } from "@/components/ui/button";

/**
 * Full-bleed horizontal intro pager: graphic collage on top, short copy below,
 * page dots, and last-panel CTAs for hosted vs self-host.
 */
export function PearlIntroPager({
  onContinueWithHost,
  onSelfHost,
  compact = false,
}: {
  readonly onContinueWithHost: () => void;
  readonly onSelfHost: () => void;
  /** Slightly tighter spacing for form sheets. */
  readonly compact?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(windowWidth);
  const [index, setIndex] = useState(0);

  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const hintColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
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
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {PEARL_INTRO_PANELS.map((panel) => (
          <View
            key={panel.id}
            style={[styles.page, { width: pageWidth }]}
          >
            <View
              style={[
                styles.graphic,
                compact ? styles.graphicCompact : null,
              ]}
            >
              <PearlIntroGraphic panelId={panel.id} />
            </View>
            <View style={styles.copy}>
              <Text
                style={[
                  compact ? styles.titleCompact : styles.title,
                  foregroundColor ? { color: foregroundColor } : null,
                ]}
              >
                {panel.title}
              </Text>
              <Text
                style={[
                  styles.body,
                  hintColor ? { color: hintColor } : null,
                ]}
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
                    i === index
                      ? (dotActive ?? "#111")
                      : (dotIdle ?? "#ccc"),
                  opacity: i === index ? 1 : 0.55,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.ctaSlot}>
          {onLast ? (
            <View style={styles.ctaStack}>
              <Button
                label="Continue with host"
                onPress={onContinueWithHost}
              />
              <Button
                label="Self-host"
                variant="secondary"
                onPress={onSelfHost}
              />
            </View>
          ) : (
            <View style={styles.ctaPlaceholder} />
          )}
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
  },
  graphicCompact: {
    minHeight: 180,
    marginTop: 0,
  },
  copy: {
    gap: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.4,
    lineHeight: 32,
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 28,
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
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
  ctaSlot: {
    minHeight: 118,
  },
  ctaStack: {
    gap: 10,
  },
  ctaPlaceholder: {
    height: 118,
  },
});
