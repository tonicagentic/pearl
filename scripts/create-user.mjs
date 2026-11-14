#!/usr/bin/env node
//
// Provision or reset an email/password account for the eve chat template.
//
// Seed an account without going through the public sign-up UI:
//
//   node scripts/create-user.mjs <email> <password> [name]
//
// Reset the credential password for an existing user:
//
//   node scripts/create-user.mjs --reset <email> <password>
//
// The password is hashed with better-auth/crypto (the same primitive the app
// uses), and the row lands in the same `user`/`account` tables Better Auth
// reads. Works against a local Postgres URL or Neon.
//
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

// Load local env files; real environment variables always win, mirroring
// drizzle.config.ts.
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

const argv = process.argv.slice(2);
const resetMode = argv[0] === "--reset";
const positional = resetMode ? argv.slice(1) : argv;
const [emailArg, passwordArg, nameArg] = positional;

if (!emailArg || !passwordArg) {
  console.error(
    resetMode
      ? "Usage: node scripts/create-user.mjs --reset <email> <password>"
      : "Usage: node scripts/create-user.mjs <email> <password> [name]",
  );
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg;
const name = nameArg?.trim() || email.split("@")[0];

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Invalid email: ${email}`);
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not set. Add it to .env.development.local (local Postgres) or export it.",
  );
  process.exit(1);
}

function isLocalDatabaseUrl(url) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function runQuery(text, params) {
  if (isLocalDatabaseUrl(databaseUrl)) {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } finally {
      await pool.end();
    }
  }

  const sql = neon(databaseUrl);
  // Plain-call sql(text, params) is removed in newer driver versions;
  // sql.query() is the conventional-call equivalent.
  return sql.query(text, params);
}

async function resetPassword(userId) {
  const passwordHash = await hashPassword(password);
  const accounts = await runQuery(
    `select id from account
     where user_id = $1 and provider_id = 'credential'
     limit 1`,
    [userId],
  );

  if (accounts.length > 0) {
    await runQuery(
      `update account
       set password = $1, updated_at = now()
       where id = $2`,
      [passwordHash, accounts[0].id],
    );
  } else {
    const accountId = randomUUID();
    await runQuery(
      `insert into account (id, account_id, provider_id, issuer, user_id, password, created_at, updated_at)
       values ($1, $2, 'credential', 'local:credential', $3, $4, now(), now())`,
      [accountId, userId, userId, passwordHash],
    );
  }

  console.log(`Reset password for ${email} (user id: ${userId})`);
}

async function createUser() {
  const existing = await runQuery(
    'select id from "user" where email = $1',
    [email],
  );

  if (existing.length > 0) {
    console.error(
      `A user with email ${email} already exists. Use --reset to change the password.`,
    );
    process.exit(1);
  }

  const userId = randomUUID();
  const accountId = randomUUID();
  const passwordHash = await hashPassword(password);

  const rows = await runQuery(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, $2, $3, true, now(), now())
     returning id, email`,
    [userId, name, email],
  );

  await runQuery(
    `insert into account (id, account_id, provider_id, issuer, user_id, password, created_at, updated_at)
     values ($1, $2, 'credential', 'local:credential', $3, $4, now(), now())`,
    [accountId, userId, userId, passwordHash],
  );

  console.log(`Created account for ${rows[0].email} (user id: ${rows[0].id})`);
}

async function main() {
  if (resetMode) {
    const existing = await runQuery(
      'select id from "user" where email = $1',
      [email],
    );
    if (existing.length === 0) {
      console.error(`No user with email ${email}.`);
      process.exit(1);
    }
    await resetPassword(existing[0].id);
    return;
  }

  await createUser();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
