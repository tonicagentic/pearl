import { Redirect } from "expo-router";

/** Compat: old `/repos` deep link → GitHub connection under Coder. */
export default function ReposRedirect() {
  return <Redirect href="/plugins/github" />;
}
