import { FileSearchIcon } from "lucide-react-native";

import {
  CapabilityDetail,
  CapabilityMark,
} from "@/components/settings/capability-detail";
import { Icon } from "@/components/ui/icon";

/** Profile → Analysis. Types Pearl can open from a chat attachment. */
export function AnalysisScreen() {
  return (
    <CapabilityDetail
      title="Analysis"
      detail="PDF, images, tables, text"
      body="Pearl reads files you attach in a chat: PDFs, images, tables, and text."
      mark={
        <CapabilityMark backgroundClassName="bg-sky-500/15">
          <Icon as={FileSearchIcon} className="size-7 text-sky-600" />
        </CapabilityMark>
      }
      sections={[
        {
          title: "Reads",
          intro: "Types Pearl can open from a chat attachment.",
          rows: [
            {
              label: "PDF",
              detail: "Read page by page, including long documents.",
            },
            {
              label: "Images",
              detail: "JPEG, PNG, GIF, and WebP.",
            },
            {
              label: "Tables and data",
              detail: "CSV and JSON, including patterns and totals.",
            },
            {
              label: "Text",
              detail: "Plain text and Markdown.",
            },
          ],
        },
      ]}
    />
  );
}
