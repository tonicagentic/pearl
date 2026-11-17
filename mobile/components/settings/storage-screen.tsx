import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { HardDriveIcon } from "lucide-react-native";

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

/** Profile → Storage. Where attached, saved, and connected files live. */
export function StorageScreen() {
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

  return (
    <CapabilityDetail
      title="Storage"
      detail="Chat, saved files, Drive"
      body="Files you attach stay with the conversation. Pearl can also keep assets it saved, and open Google Drive when that account is connected."
      mark={
        <CapabilityMark backgroundClassName="bg-sky-500/15">
          <Icon as={HardDriveIcon} className="size-7 text-sky-600" />
        </CapabilityMark>
      }
      sections={[
        {
          title: "Places",
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
            driveStatus(drive),
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
