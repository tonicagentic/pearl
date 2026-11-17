import { PenLineIcon } from "lucide-react-native";

import {
  CapabilityDetail,
  CapabilityMark,
} from "@/components/settings/capability-detail";
import { Icon } from "@/components/ui/icon";

/** Profile → Drafting. Writing styles Pearl applies. */
export function DraftingScreen() {
  return (
    <CapabilityDetail
      title="Drafting"
      detail="Writing and style"
      body="Pearl drafts and revises prose with you. General style is always on. Other styles load when the piece calls for them."
      mark={
        <CapabilityMark backgroundClassName="bg-indigo-500/15">
          <Icon as={PenLineIcon} className="size-7 text-indigo-500" />
        </CapabilityMark>
      }
      sections={[
        {
          title: "Writing",
          intro: "Standing rules for prose other people will read.",
          rows: [
            {
              label: "General style",
              detail:
                "Oxford comma, active voice, straight quotes, content headings, and spare em dashes.",
              trailing: "On",
            },
            {
              label: "Standing notes",
              detail:
                "Preferences you state in chat stay with your account and apply on later drafts.",
            },
          ],
        },
        {
          title: "When the piece needs it",
          rows: [
            {
              label: "Public editorial",
              detail: "Essays, talks, and public argument.",
            },
            {
              label: "Technical blog",
              detail: "Systems, mechanisms, and experiments.",
            },
            {
              label: "Blog",
              detail: "Posts written for a site.",
            },
            {
              label: "Newsletter",
              detail: "Email editions.",
            },
            {
              label: "X",
              detail: "Short posts.",
            },
            {
              label: "LinkedIn",
              detail: "Posts for a professional feed.",
            },
            {
              label: "Release notes",
              detail: "What shipped, in plain language.",
            },
          ],
        },
      ]}
    />
  );
}
