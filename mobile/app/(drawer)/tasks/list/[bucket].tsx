import { useLocalSearchParams } from "expo-router";

import { TaskListScreen } from "@/components/tasks/task-list-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function TaskSmartListRoute() {
  const params = useLocalSearchParams<{
    readonly bucket?: string;
    readonly areaRoot?: string;
    readonly areaName?: string;
  }>();
  const bucket = typeof params.bucket === "string" ? params.bucket : "inbox";
  const areaRootName =
    typeof params.areaRoot === "string" ? params.areaRoot : undefined;
  const defaultAreaName =
    typeof params.areaName === "string" ? params.areaName : undefined;

  return (
    <RequireSignedIn>
      <TaskListScreen
        bucketParam={bucket}
        areaRootName={areaRootName}
        defaultAreaName={defaultAreaName}
      />
    </RequireSignedIn>
  );
}
