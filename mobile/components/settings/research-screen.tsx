import { PluginLogo } from "@/components/settings/plugin-logo";
import { CapabilityDetail } from "@/components/settings/capability-detail";

/** Profile → Research. Sources a deep-research pass can use. */
export function ResearchScreen() {
  return (
    <CapabilityDetail
      title="Research"
      detail="Deep research with citations"
      body="Research searches several angles, reads the pages, and returns findings with a source and a confidence level. Claims it cannot verify come back as gaps."
      mark={<PluginLogo id="researcher" size={56} />}
      sections={[
        {
          title: "Sources",
          intro: "Deep research uses the open web.",
          rows: [
            {
              label: "Web search",
              detail: "Specific queries, then more angles until the question is covered.",
              trailing: "On",
            },
            {
              label: "Pages",
              detail: "Opens a result and reads it before citing. Snippets alone are not a source.",
              trailing: "On",
            },
            {
              label: "Exa",
              detail:
                "Multi-step research for companies, funding, competitors, people, and news.",
              trailing: "On",
            },
            {
              label: "Primary sources",
              detail:
                "Official docs, filings, standards, and reputable outlets, ahead of blogs and aggregators.",
              trailing: "On",
            },
          ],
        },
      ]}
    />
  );
}
