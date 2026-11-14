import { redirect } from "next/navigation";

/** Compat: old /repos route → GitHub connection settings. */
export default function ReposRedirectPage() {
  redirect("/settings/connections/github");
}
