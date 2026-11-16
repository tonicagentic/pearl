import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { FolderOpenIcon } from "lucide-react-native";

import {
  CapabilityDetail,
  CapabilityMark,
  type CapabilityRow,
} from "@/components/settings/capability-detail";
import { Icon } from "@/components/ui/icon";
import {
  getConnections,
  type ConnectionStatus,
} from "@/src/connections-client";

/** Profile → Files. What Pearl can read, and where files live. */
export function FilesScreen() {
  const [drive, setDrive] = useState<ConnectionStatus | null | undefined>(
    undefined,
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getConnections()
        .then((connections) => {
          if (cancelled) return;
          setDrive(connections.find((item) => item.id === "drive") ?? null);
        })
        .catch(() => {
          if (!cancelled) setDrive(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const driveRow = driveStatus(drive);

  return (
    <CapabilityDetail
      title="Files"
      detail="Analysis and storage"
      body="Pearl reads files you attach and files it has saved, and can open Google Drive when that account is connected."
      mark={
        <CapabilityMark backgroundClassName="bg-sky-500/15">
          <Icon as={FolderOpenIcon} className="size-7 text-sky-600" />
        </CapabilityMark>
      }
      sections={[
        {
          title: "Analysis",
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
        {
          title: "Storage",
          rows: [
            {
              label: "This chat",
              detail: "Files you attach stay with the conversation.",
              trailing: "On",
            },
            {
              label: "Saved files",
              detail: "Assets Pearl stores and can list again later.",
              trailing: "On",
            },
            driveRow,
            {
              label: "iCloud Drive",
              detail: "Files and folders in iCloud.",
              trailing: "Coming soon",
            },
            {
              label: "Pearl Cloud",
              detail: "Pearl-hosted files and workspace storage.",
              trailing: "Coming soon",
            },
          ],
        },
      ]}
    />
  );
}

function driveStatus(
  drive: ConnectionStatus | null | undefined,
): CapabilityRow {
  if (drive === undefined) {
    return {
      label: "Google Drive",
      detail: "Docs, Sheets, Slides, and other Drive files you can open.",
      trailing: "…",
    };
  }
  if (drive == null || drive.status === "unavailable") {
    return {
      label: "Google Drive",
      detail: "Docs, Sheets, Slides, and other Drive files you can open.",
      trailing: "Unavailable",
    };
  }
  if (drive.status === "unknown") {
    return {
      label: "Google Drive",
      detail: "Docs, Sheets, Slides, and other Drive files you can open.",
      trailing: "…",
    };
  }
  if (drive.status === "connected") {
    return {
      label: "Google Drive",
      detail: "Docs, Sheets, Slides, and other Drive files you can open.",
      trailing: drive.accountLabel?.trim() || "Connected",
      onPress: () => router.push("/plugins/drive"),
    };
  }
  return {
    label: "Google Drive",
    detail: "Docs, Sheets, Slides, and other Drive files you can open.",
    trailing: "Connect",
    trailingAccent: true,
    onPress: () => router.push("/plugins/drive"),
  };
}
