import { Redirect, useLocalSearchParams } from "expo-router";

/** Legacy /issues/:id → /tasks/:id */
export default function IssuesRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id || typeof id !== "string") {
    return <Redirect href="/" />;
  }
  return (
    <Redirect
      href={`/tasks/${encodeURIComponent(id)}`}
      withAnchor
    />
  );
}
