import { Redirect } from "expo-router";

/** Compat: home now lives at `/`. */
export default function HistoryRedirect() {
  return <Redirect href="/" />;
}
