"use client";

import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react";
import type { Spec } from "@json-render/core";
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

const SHORT_TABLE_SAMPLE = [
  "Quick comparison:",
  "```spec",
  '{"op":"add","path":"/root","value":"card"}',
  '{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"Espresso machines","description":null},"children":["table"]}}',
  '{"op":"add","path":"/elements/table","value":{"type":"Table","props":{"columns":["Model","Price","Boiler","Best for"],"rows":[["Bambino Plus","$500","ThermoJet","Speed + milk"],["Classic Pro","$450","Single","Manual control"],["Dedica Arte","$300","Thermoblock","Small kitchens"]]},"children":[]}}',
  "```",
].join("\n");

const WIDE_TABLE_SAMPLE = [
  "Here are five consultation options across San Francisco and Colorado:",
  "```spec",
  '{"op":"add","path":"/root","value":"card"}',
  '{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"Rhinoplasty consultation shortlist","description":"Two San Francisco options, two Denver options, and one in Boulder."},"children":["table"]}}',
  '{"op":"add","path":"/elements/table","value":{"type":"Table","props":{"columns":["Surgeon / practice","Location","Why consider a consultation","Booking"],"rows":[["Raj Dedhia — RD Face","San Francisco","Facial plastic surgeon focused on rhinoplasty; good SF starting point for a primary consult.","415-956-3223"],["David Kim — Kim Facial Plastic Surgery","San Francisco","High-volume rhinoplasty practice; useful second SF opinion before traveling.","Online consultation request via practice site"],["Andrew Winkler — CU Facial Plastic Surgery","Denver — 850 E. Harvard Ave., Suite 575","Facial plastics / reconstructive training; clear academic Denver option.","303-724-1950"],["Jeffrey Raval — Raval Facial Aesthetics","Denver — Cherry Creek","Cosmetic facial plastics in Cherry Creek; convenient private-practice Denver consult.","303-381-3223"],["Andrew Menachof — FacesFirst","Boulder — 350 Broadway","Facial plastics practice with rhinoplasty emphasis; Boulder option without a Denver trip.","303-744-1961"]]},"children":[]}}',
  "```",
].join("\n");

function SmokeSpec({
  title,
  sample,
}: {
  readonly title: string;
  readonly sample: string;
}) {
  const parsed = parseInlineSpec(sample);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      <div className="text-foreground flex flex-col gap-3 text-[15px] leading-6">
        {parsed.segments.map((segment, index) => {
          if (segment.type === "text") {
            return <MarkdownContent key={index} text={segment.text} />;
          }
          if (!parsed.spec) return null;
          return (
            <SpecRenderer key="spec" spec={parsed.spec} />
          );
        })}
      </div>
    </section>
  );
}

function SpecRenderer({ spec }: { readonly spec: Spec }) {
  return (
    <div data-slot="aui_json-render">
      <StateProvider initialState={{}}>
        <VisibilityProvider>
          <ActionProvider
            handlers={{
              reply: async (params) => {
                const message =
                  typeof params.message === "string" ? params.message : "";
                window.alert(`reply: ${message}`);
              },
            }}
          >
            <Renderer
              spec={spec}
              registry={chatRegistry}
              fallback={() => null}
            />
          </ActionProvider>
        </VisibilityProvider>
      </StateProvider>
    </div>
  );
}

/**
 * Dev-only visual check for inline json-render chat cards.
 * Visit /dev/json-render-smoke — no agent turn required.
 */
export default function JsonRenderSmokePage() {
  if (process.env.NODE_ENV === "production") {
    return <p className="p-6 text-sm">Not available in production.</p>;
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-10 p-6">
      <h1 className="text-lg font-medium">json-render smoke</h1>
      <SmokeSpec title="Comparison card" sample={SAMPLE} />
      <SmokeSpec title="Short table" sample={SHORT_TABLE_SAMPLE} />
      <SmokeSpec title="Wide shortlist table" sample={WIDE_TABLE_SAMPLE} />
    </main>
  );
}
