import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

/** Soft top/bottom fades so message overflow dissolves into the chrome. */
export function ThreadEdgeFades({
  topHeight,
  bottomHeight,
}: {
  readonly topHeight: number;
  readonly bottomHeight: number;
}) {
  const background = (useCSSVariable("--color-background") as string | undefined) ??
    "#FFFFFF";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {topHeight > 0 ? (
        <View style={[styles.top, { height: topHeight }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="threadTopFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={background} stopOpacity="1" />
                <Stop offset="0.55" stopColor={background} stopOpacity="0.55" />
                <Stop offset="1" stopColor={background} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#threadTopFade)" />
          </Svg>
        </View>
      ) : null}
      {bottomHeight > 0 ? (
        <View style={[styles.bottom, { height: bottomHeight }]}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="threadBottomFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={background} stopOpacity="0" />
                <Stop offset="0.45" stopColor={background} stopOpacity="0.55" />
                <Stop offset="1" stopColor={background} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#threadBottomFade)" />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
