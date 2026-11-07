"use client";

import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react";
import { chatRegistry } from "@/components/json-render/registry";
import { parseInlineSpec } from "@/lib/json-render/inline-spec";
import { MarkdownContent } from "@/components/assistant-ui/elements/markdown-content";

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

/**
 * Dev-only visual check for inline json-render chat cards.
 * Visit /dev/json-render-smoke — no agent turn required.
 */
export default function JsonRenderSmokePage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-6 text-sm">Not available in production.</p>;
  }

  const parsed = parseInlineSpec(SAMPLE);
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-lg font-medium">json-render smoke</h1>
      <div className="text-foreground flex flex-col gap-3 text-[15px] leading-6">
        {parsed.segments.map((segment, index) => {
          if (segment.type === "text") {
            return <MarkdownContent key={index} text={segment.text} />;
          }
          if (!parsed.spec) return null;
          return (
            <div key="spec" data-slot="aui_json-render">
              <StateProvider initialState={{}}>
                <VisibilityProvider>
                  <ActionProvider
                    handlers={{
                      reply: async (params) => {
                        const message =
                          typeof params.message === "string"
                            ? params.message
                            : "";
                        window.alert(`reply: ${message}`);
                      },
                    }}
                  >
                    <Renderer
                      spec={parsed.spec}
                      registry={chatRegistry}
                      fallback={() => null}
                    />
                  </ActionProvider>
                </VisibilityProvider>
              </StateProvider>
            </div>
          );
        })}
      </div>
    </main>
  );
}
