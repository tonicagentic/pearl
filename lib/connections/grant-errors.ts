/** User-facing copy when a coder ship step fails on a Pearl Connect grant. */

export function githubPushDeniedMessage(
  owner?: string,
  manageUrl?: string,
): string {
  const where = owner?.trim() ? ` for ${owner.trim()}` : "";
  const grantWhere = manageUrl?.trim()
    ? manageUrl.trim()
    : "Settings → GitHub → Authorized OAuth Apps";
  return (
    `Pearl's GitHub connection cannot push as you${where}. ` +
    `Open ${grantWhere}, grant the organization, then Update in Settings → GitHub. ` +
    "This is the Connect app grant, not your GitHub account permissions."
  );
}

export function vercelTokenUnavailableMessage(cause?: string): string {
  const detail = cause?.trim() ? ` (${cause.trim()})` : "";
  return (
    `Vercel is not authorized for your Pearl account${detail}. ` +
    "Open Settings → Vercel and Connect or Update, then retry the deploy."
  );
}

/** True when git/gh stderr looks like an OAuth/org access denial. */
export function looksLikeGithubGrantDenial(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b403\b/.test(lower) &&
    (lower.includes("permission") ||
      lower.includes("access") ||
      lower.includes("denied") ||
      lower.includes("oauth") ||
      lower.includes("resource not accessible") ||
      lower.includes("write access"))
  );
}
