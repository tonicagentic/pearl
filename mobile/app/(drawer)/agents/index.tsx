import { Redirect } from "expo-router";

/** Delegate list is parked; restore `AgentsScreen` here when it returns. */
export default function Agents() {
  return <Redirect href="/" />;
}
