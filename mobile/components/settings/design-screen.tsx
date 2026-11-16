import { LayoutTemplateIcon } from "lucide-react-native";

import {
  CapabilityDetail,
  CapabilityMark,
} from "@/components/settings/capability-detail";
import { Icon } from "@/components/ui/icon";

/** Profile → Design. Presentations, documents, and laid-out pieces. */
export function DesignScreen() {
  return (
    <CapabilityDetail
      title="Design"
      detail="Presentations, documents, and layouts"
      body="Design lays out a piece for someone to read or hold. Graphics, diagrams, SVGs, and generated images live under Visualize."
      mark={
        <CapabilityMark backgroundClassName="bg-violet-500/15">
          <Icon as={LayoutTemplateIcon} className="size-7 text-violet-500" />
        </CapabilityMark>
      }
      sections={[
        {
          title: "Layouts",
          rows: [
            {
              label: "Presentations",
              detail: "Slide structure, hierarchy, and the sequence of a deck.",
            },
            {
              label: "Documents",
              detail: "Print-ready pages and PDFs from a layout.",
            },
            {
              label: "Invitations",
              detail: "Cards and one-page pieces with type, spacing, and art.",
            },
            {
              label: "Logos",
              detail: "Marks, wordmarks, and lockups.",
            },
            {
              label: "Other layouts",
              detail: "Posters, social graphics, and page mockups.",
            },
          ],
        },
      ]}
    />
  );
}
