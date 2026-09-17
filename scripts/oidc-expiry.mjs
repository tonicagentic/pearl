// Prints non-secret metadata about the local VERCEL_OIDC_TOKEN: when it
// expires and whether it is currently expired. Never prints the token.
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const match = env.match(/^VERCEL_OIDC_TOKEN=(.+)$/m);

if (!match) {
  console.log("no VERCEL_OIDC_TOKEN in .env.local");
  process.exit(0);
}

const token = match[1].trim().replace(/^"|"$/g, "");
const segment = token.split(".")[1];

if (!segment) {
  console.log("token is not a JWT; segments:", token.split(".").length);
  process.exit(0);
}

const payload = JSON.parse(Buffer.from(segment, "base64").toString());
const exp = payload.exp ?? 0;
const now = Date.now() / 1000;

console.log("token issued at :", new Date((payload.iat ?? 0) * 1000).toISOString());
console.log("token expires   :", new Date(exp * 1000).toISOString());
console.log("now             :", new Date().toISOString());
console.log("expired         :", now > exp);
console.log("minutes left    :", Math.round((exp - now) / 60));
