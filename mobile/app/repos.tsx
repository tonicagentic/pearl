import { Redirect } from "expo-router";

/** Compat: old `/repos` deep link → Mail home (Repos lives under Settings). */
export default function ReposRedirect() {
  return <Redirect href="/" />;
}
