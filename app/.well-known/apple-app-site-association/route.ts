import { NextResponse } from "next/server";

/**
 * Apple App Site Association for password Autofill (webcredentials).
 * Served at https://pearl.tonicagentic.com/.well-known/apple-app-site-association
 *
 * Set APPLE_TEAM_ID on the deploy (e.g. Vercel env). Without it, apps list is empty
 * so Autofill association stays off until configured.
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim() ?? "";
  const apps = teamId
    ? [
        `${teamId}.com.tonicagentic.pearl`,
        `${teamId}.com.tonicagentic.pearlmoney`,
        `${teamId}.com.tonicagentic.pearltasks`,
      ]
    : [];

  const body = {
    webcredentials: {
      apps,
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
