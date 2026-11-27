/**
 * Local verification: sandbox Plaid + open access for every signed-in user.
 *   PLAID_ENV=sandbox node --env-file=.env.local scripts/verify-finance-sandbox.mjs
 *
 * If entity create fails with a user_id FK error, drop finance.* → public.user
 * FKs as the Neon owner once:
 *   DATABASE_URL_UNPOOLED=… node scripts/apply-finance-drop-user-fks.mjs
 */

async function signInAnonymous() {
  const res = await fetch("http://127.0.0.1:3000/api/auth/sign-in/anonymous", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:3000",
    },
    body: "{}",
  });
  const json = await res.json();
  const token = res.headers.get("set-auth-token");
  if (!res.ok || !token) {
    throw new Error(`anonymous sign-in failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return { token, userId: json.user.id, email: json.user.email };
}

async function api(token, path, init = {}) {
  const res = await fetch(`http://127.0.0.1:3000${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      origin: "http://127.0.0.1:3000",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const userA = await signInAnonymous();
const userB = await signInAnonymous();
console.log("users", userA.email.slice(0, 24), userB.email.slice(0, 24));

const linkToken = await api(userA.token, "/api/v1/plaid/link-token", {
  method: "POST",
  body: "{}",
});
console.log("link-token", linkToken.status, {
  env: linkToken.json.env,
  sandbox: linkToken.json.sandbox,
  hasToken: Boolean(linkToken.json.linkToken),
});

const accountsA = await api(userA.token, "/api/v1/accounts");
const accountsB = await api(userB.token, "/api/v1/accounts");
console.log("accounts status A/B", accountsA.status, accountsB.status);
console.log(
  "no owner-gate 403",
  accountsA.status !== 403 && accountsB.status !== 403,
);

const entities = await api(userA.token, "/api/v1/entities", {
  method: "POST",
  body: JSON.stringify({ name: "Anon A", taxClass: "individual" }),
});
console.log("create entity", entities.status, entities.json.createdId || entities.json.error);

let sandbox = { status: 0, json: {} };
if (entities.json.createdId) {
  sandbox = await api(userA.token, "/api/v1/plaid/sandbox-link", {
    method: "POST",
    body: JSON.stringify({ entityId: entities.json.createdId }),
  });
  console.log("sandbox-link", sandbox.status, {
    itemId: sandbox.json.itemId,
    accounts: sandbox.json.accounts?.length,
    error: sandbox.json.error,
  });
  if (sandbox.json.itemId) {
    const removed = await api(
      userA.token,
      `/api/v1/plaid/items/${sandbox.json.itemId}`,
      { method: "DELETE" },
    );
    console.log("remove item", removed.status, removed.json.ok || removed.json.error);
  }
} else {
  console.log(
    "NOTE: entity create failed — apply 0004_drop_user_fks as Neon owner so local users can write the ledger.",
  );
}

const openAccessOk =
  linkToken.status === 200 &&
  linkToken.json.sandbox === true &&
  accountsA.status === 200 &&
  accountsB.status === 200;

const writesOk = Boolean(sandbox.json.itemId);

console.log(
  openAccessOk
    ? writesOk
      ? "VERIFY_OK"
      : "VERIFY_OK_OPEN_ACCESS_SANDBOX (writes need FK migration)"
    : "VERIFY_FAIL",
);
process.exit(openAccessOk ? 0 : 1);
