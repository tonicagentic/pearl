import { ImageIcon } from "lucide-react-native";

import {
  CapabilityDetail,
  CapabilityMark,
} from "@/components/settings/capability-detail";
import { Icon } from "@/components/ui/icon";

/** Profile → Visualize. Graphics, diagrams, SVGs, and generated images. */
export function VisualizeScreen() {
  return (
    <CapabilityDetail
      title="Visualize"
      detail="Graphics, diagrams, and images"
      body="Visualize makes the picture. Layouts, invitations, and logos live under Design."
      mark={
        <CapabilityMark backgroundClassName="bg-fuchsia-500/15">
          <Icon as={ImageIcon} className="size-7 text-fuchsia-500" />
        </CapabilityMark>
      }
      sections={[
        {
          title: "Creates",
          rows: [
            {
              label: "Graphics",
              detail: "Charts, figures, and other pictures that explain a point.",
            },
            {
              label: "Diagrams",
              detail: "Flows, sequences, and architecture, drawn from Mermaid.",
            },
            {
              label: "SVGs",
              detail: "Vector artwork Pearl writes or generates.",
            },
            {
              label: "Images",
              detail: "Pictorial images from the image model in Models.",
            },
          ],
        },
      ]}
    />
  );
}
