import { NextResponse } from "next/server";

/**
 * Digital Asset Links for Android credential Autofill.
 * Served at https://pearl.tonicagentic.com/.well-known/assetlinks.json
 *
 * Set ANDROID_CERT_FINGERPRINTS to a comma-separated list of SHA-256 cert
 * fingerprints (EAS/Play signing). Without fingerprints, returns an empty list.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const packages = ["com.tonicagentic.pearl", "com.tonicagentic.pearlmoney"];

  const body =
    fingerprints.length === 0
      ? []
      : packages.map((packageName) => ({
          relation: ["delegate_permission/common.get_login_creds"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: fingerprints,
          },
        }));

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
