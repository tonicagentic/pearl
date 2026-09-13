import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Load local env files so `pnpm db:migrate` and `pnpm db:push` work without
// manually sourcing .env.local first. Values already present in process.env
// always win, so `vercel env run -e production -- pnpm db:migrate` is
// unaffected. .env.development.local is loaded first, giving the local
// Postgres URL precedence over values pulled into .env.local by
// `vercel env pull`.
for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      const key = match?.[1];
      const value = match?.[2]?.replace(/^["']|["']$/g, "") ?? "";
      if (key && value && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // A missing env file is fine.
  }
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
