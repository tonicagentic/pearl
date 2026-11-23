import { Platform } from "react-native";
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from "expo-iap";

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import {
  APPLE_IAP_SUBSCRIPTION_ID,
  APPLE_USAGE_PRODUCT_IDS,
} from "./iap-products";

let connectionReady = false;

function authHeaders(): HeadersInit {
  const token = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function ensureIapConnection(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  if (connectionReady) return true;
  try {
    await initConnection();
    connectionReady = true;
    return true;
  } catch {
    return false;
  }
}

export async function teardownIapConnection(): Promise<void> {
  if (!connectionReady) return;
  try {
    await endConnection();
  } catch {
    // ignore
  }
  connectionReady = false;
}

function purchaseJws(purchase: Purchase): string | null {
  const token =
    typeof purchase.purchaseToken === "string" ? purchase.purchaseToken.trim() : "";
  return token || null;
}

async function verifyOnServer(signedTransaction: string): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/billing/apple/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ signedTransaction }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? "Could not verify Apple purchase.");
  }
}

async function finalizePurchase(
  purchase: Purchase,
  isConsumable: boolean,
): Promise<void> {
  const jws = purchaseJws(purchase);
  if (!jws) {
    throw new Error("Purchase is missing a StoreKit transaction token.");
  }
  await verifyOnServer(jws);
  await finishTransaction({ purchase, isConsumable });
}

function waitForPurchase(sku: string): Promise<Purchase> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      updated.remove();
      errored.remove();
      reject(new Error("Purchase timed out."));
    }, 120_000);

    const updated = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== sku) return;
      clearTimeout(timeout);
      updated.remove();
      errored.remove();
      resolve(purchase);
    });

    const errored = purchaseErrorListener((error) => {
      clearTimeout(timeout);
      updated.remove();
      errored.remove();
      const message = error.message || "Purchase failed.";
      if (
        error.code === "user-cancelled" ||
        /cancel/i.test(message)
      ) {
        reject(new Error("Purchase cancelled."));
        return;
      }
      reject(new Error(message));
    });
  });
}

export async function fetchIapCatalog(): Promise<{
  readonly subscription: { readonly id: string } | null;
  readonly packs: readonly { readonly id: string }[];
}> {
  if (!(await ensureIapConnection())) {
    return { subscription: null, packs: [] };
  }

  const [subs, packs] = await Promise.all([
    fetchProducts({
      skus: [APPLE_IAP_SUBSCRIPTION_ID],
      type: "subs",
    }),
    fetchProducts({
      skus: [...APPLE_USAGE_PRODUCT_IDS],
      type: "in-app",
    }),
  ]);

  const subscription =
    (subs ?? []).find((product) => product.id === APPLE_IAP_SUBSCRIPTION_ID) ??
    null;
  return { subscription, packs: packs ?? [] };
}

export async function purchaseAppleSubscription(): Promise<void> {
  if (!(await ensureIapConnection())) {
    throw new Error("In-app purchases are unavailable on this device.");
  }
  const pending = waitForPurchase(APPLE_IAP_SUBSCRIPTION_ID);
  await requestPurchase({
    request: { apple: { sku: APPLE_IAP_SUBSCRIPTION_ID } },
    type: "subs",
  });
  const purchase = await pending;
  await finalizePurchase(purchase, false);
}

export async function purchaseAppleUsagePack(productId: string): Promise<void> {
  if (!(await ensureIapConnection())) {
    throw new Error("In-app purchases are unavailable on this device.");
  }
  if (!APPLE_USAGE_PRODUCT_IDS.includes(productId as (typeof APPLE_USAGE_PRODUCT_IDS)[number])) {
    throw new Error("Unknown usage pack.");
  }
  const pending = waitForPurchase(productId);
  await requestPurchase({
    request: { apple: { sku: productId } },
    type: "in-app",
  });
  const purchase = await pending;
  await finalizePurchase(purchase, true);
}

/** Restore active Apple subscriptions and re-verify on the server. */
export async function restoreApplePurchases(): Promise<number> {
  if (!(await ensureIapConnection())) {
    throw new Error("In-app purchases are unavailable on this device.");
  }
  const purchases = await getAvailablePurchases();
  let restored = 0;
  for (const purchase of purchases ?? []) {
    if (purchase.productId !== APPLE_IAP_SUBSCRIPTION_ID) continue;
    try {
      await finalizePurchase(purchase, false);
      restored += 1;
    } catch {
      // continue other transactions
    }
  }
  return restored;
}
