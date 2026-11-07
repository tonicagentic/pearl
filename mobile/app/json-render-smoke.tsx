import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, Text, View, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react-native";
import { parseInlineSpec } from "../../lib/json-render/inline-spec";
import { chatRegistry } from "@/components/json-render/registry";

const SAMPLE = [
  "No is leading on Prop 40 with most of the expected vote counted.",
  "```spec",
  '{"op":"add","path":"/root","value":"card"}',
  '{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"California Prop 40","description":"Wealth tax — early results"},"children":["badge","bar","metrics"]}}',
  '{"op":"add","path":"/elements/badge","value":{"type":"Badge","props":{"label":"No leading","tone":"negative"},"children":[]}}',
  '{"op":"add","path":"/elements/bar","value":{"type":"ComparisonBar","props":{"leftLabel":"No","leftValue":53.7,"rightLabel":"Yes","rightValue":46.3,"caption":"~72% of expected vote counted"},"children":[]}}',
  '{"op":"add","path":"/elements/metrics","value":{"type":"Stack","props":{"direction":"horizontal","gap":"md"},"children":["m1","m2","m3"]}}',
  '{"op":"add","path":"/elements/m1","value":{"type":"Metric","props":{"label":"No votes","value":"5.27M"},"children":[]}}',
  '{"op":"add","path":"/elements/m2","value":{"type":"Metric","props":{"label":"Yes votes","value":"4.54M"},"children":[]}}',
  '{"op":"add","path":"/elements/m3","value":{"type":"Metric","props":{"label":"Counted","value":"72%","hint":"expected vote"},"children":[]}}',
  "```",
  "Decision Desk HQ called it for No; the LA Times is still treating it as undecided.",
].join("\n");

class SmokeErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[json-render-smoke]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.pad}>
          <Text style={styles.errorTitle}>Render error</Text>
          <Text style={styles.errorBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Dev smoke screen for inline json-render — open via pearl:///json-render-smoke. */
export default function JsonRenderSmokeScreen() {
  const parsed = parseInlineSpec(SAMPLE);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>json-render smoke</Text>
        <SmokeErrorBoundary>
          <View style={styles.stack}>
            {parsed.segments.map((segment, index) => {
              if (segment.type === "text") {
                return (
                  <Text key={`text-${index}`} style={styles.prose}>
                    {segment.text}
                  </Text>
                );
              }
              if (!parsed.spec) return null;
              return (
                <View key="spec" style={styles.specWrap}>
                  <StateProvider initialState={{}}>
                    <VisibilityProvider>
                      <ActionProvider
                        handlers={{
                          reply: async (params) => {
                            const message =
                              typeof params.message === "string"
                                ? params.message
                                : "";
                            Alert.alert("reply", message);
                          },
                        }}
                      >
                        <Renderer
                          spec={parsed.spec}
                          registry={chatRegistry}
                          includeStandard={false}
                          fallback={() => null}
                        />
                      </ActionProvider>
                    </VisibilityProvider>
                  </StateProvider>
                </View>
              );
            })}
          </View>
        </SmokeErrorBoundary>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f4f5" },
  content: { gap: 16, paddingHorizontal: 16, paddingVertical: 16 },
  title: { fontSize: 18, fontWeight: "600", color: "#111" },
  stack: { gap: 12 },
  prose: { fontSize: 15, lineHeight: 22, color: "#111" },
  specWrap: { gap: 8 },
  pad: { padding: 16, gap: 8 },
  errorTitle: { fontSize: 16, fontWeight: "600", color: "#b91c1c" },
  errorBody: { fontSize: 13, color: "#7f1d1d", fontFamily: "Menlo" },
});
