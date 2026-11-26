import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
  Type,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { and, eq, sql } from "drizzle-orm";

import {
  INCLUDED_USAGE_CENTS,
  getAppleAppAppleId,
  getAppleIapBundleId,
  getAppleIapSubscriptionId,
  getAppleUsagePackCredits,
  isAppleIapConfigured,
} from "@/lib/billing/config";
import {
  findBillingAccountByAppleOriginal,
  getBillingAccount,
  getUserBillingFlags,
  upsertBillingAccount,
} from "@/lib/billing/accounts";
import { db } from "@/lib/db/client";
import { appleIapTransaction, billingAccount } from "@/lib/db/schema";

let rootCerts: Buffer[] | null = null;

function loadAppleRootCertificates(): Buffer[] {
  if (rootCerts) return rootCerts;
  const dir = join(process.cwd(), "lib/billing/certs");
  rootCerts = [
    readFileSync(join(dir, "AppleIncRootCertificate.cer")),
    readFileSync(join(dir, "AppleRootCA-G2.cer")),
    readFileSync(join(dir, "AppleRootCA-G3.cer")),
  ];
  return rootCerts;
}

async function createVerifier(
  environment: Environment,
): Promise<SignedDataVerifier> {
  const bundleId = getAppleIapBundleId();
  const appAppleId = getAppleAppAppleId() ?? undefined;
  if (environment === Environment.PRODUCTION && appAppleId == null) {
    throw new Error(
      "APPLE_APP_APPLE_ID is required to verify Production App Store transactions.",
    );
  }
  return new SignedDataVerifier(
    loadAppleRootCertificates(),
    true,
    environment,
    bundleId,
    appAppleId,
  );
}

/**
 * Verify a StoreKit 2 JWS transaction. Tries Production first when configured,
 * then Sandbox (device sandbox purchases often look production-shaped).
 */
export async function verifyAppleTransactionJws(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  const attempts: Environment[] = [
    Environment.PRODUCTION,
    Environment.SANDBOX,
  ];
  let lastError: unknown;
  for (const environment of attempts) {
    try {
      if (
        environment === Environment.PRODUCTION &&
        getAppleAppAppleId() == null
      ) {
        continue;
      }
      const verifier = await createVerifier(environment);
      return await verifier.verifyAndDecodeTransaction(signedTransaction);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not verify Apple transaction.");
}

export async function verifyAppleNotificationPayload(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  const attempts: Environment[] = [
    Environment.PRODUCTION,
    Environment.SANDBOX,
  ];
  let lastError: unknown;
  for (const environment of attempts) {
    try {
      if (
        environment === Environment.PRODUCTION &&
        getAppleAppAppleId() == null
      ) {
        continue;
      }
      const verifier = await createVerifier(environment);
      return await verifier.verifyAndDecodeNotification(signedPayload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not verify Apple notification.");
}

function msToDate(ms: number | undefined): Date | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms);
}

function isSubscriptionProduct(productId: string): boolean {
  return productId === getAppleIapSubscriptionId();
}

function creditCentsForProduct(productId: string): number | null {
  const packs = getAppleUsagePackCredits();
  return packs[productId] ?? null;
}

async function recordAppleTransaction(input: {
  readonly transactionId: string;
  readonly userId: string;
  readonly productId: string;
  readonly kind: "subscription" | "consumable";
  readonly creditCents: number;
}): Promise<boolean> {
  const inserted = await db
    .insert(appleIapTransaction)
    .values({
      transactionId: input.transactionId,
      userId: input.userId,
      productId: input.productId,
      kind: input.kind,
      creditCents: input.creditCents,
    })
    .onConflictDoNothing()
    .returning({ transactionId: appleIapTransaction.transactionId });
  return inserted.length > 0;
}

/**
 * Apply a verified subscription transaction to the user's billing account.
 */
export async function applyAppleSubscription(input: {
  readonly userId: string;
  readonly transaction: JWSTransactionDecodedPayload;
}): Promise<{ readonly status: string }> {
  const { userId, transaction } = input;
  const productId = transaction.productId;
  const originalTransactionId = transaction.originalTransactionId;
  const transactionId = transaction.transactionId;
  if (!productId || !originalTransactionId || !transactionId) {
    throw new Error("Apple subscription transaction is incomplete.");
  }
  if (!isSubscriptionProduct(productId)) {
    throw new Error(`Unknown Apple subscription product: ${productId}`);
  }

  const flags = await getUserBillingFlags(userId);
  if (!flags || flags.exempt) {
    throw new Error("This account cannot be billed via Apple IAP.");
  }

  const existingByOriginal =
    await findBillingAccountByAppleOriginal(originalTransactionId);
  if (existingByOriginal && existingByOriginal.userId !== userId) {
    throw new Error("This Apple subscription is linked to another account.");
  }

  const revoked = transaction.revocationDate != null;
  const expires = msToDate(transaction.expiresDate);
  const now = new Date();
  const active =
    !revoked && (expires == null || expires.getTime() > now.getTime());
  const status = active ? "active" : "expired";

  if (transactionId) {
    await recordAppleTransaction({
      transactionId,
      userId,
      productId,
      kind: "subscription",
      creditCents: 0,
    });
  }

  const existing = await getBillingAccount(userId);
  await upsertBillingAccount({
    userId,
    stripeCustomerId: existing?.stripeCustomerId ?? null,
    stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
    status,
    periodStart: msToDate(transaction.purchaseDate) ?? existing?.periodStart,
    periodEnd: expires ?? existing?.periodEnd,
    metronomeCustomerId: existing?.metronomeCustomerId ?? null,
    usageCapCents: existing?.usageCapCents ?? INCLUDED_USAGE_CENTS,
    paymentProvider: "apple",
    appleOriginalTransactionId: originalTransactionId,
    appleProductId: productId,
    appleEnvironment:
      typeof transaction.environment === "string"
        ? String(transaction.environment)
        : null,
    prepaidCreditCents: existing?.prepaidCreditCents,
  });

  return { status };
}

/**
 * Apply a verified consumable usage pack to prepaid credits.
 */
export async function applyAppleConsumable(input: {
  readonly userId: string;
  readonly transaction: JWSTransactionDecodedPayload;
}): Promise<{ readonly creditCents: number; readonly prepaidCreditCents: number }> {
  const { userId, transaction } = input;
  const productId = transaction.productId;
  const transactionId = transaction.transactionId;
  if (!productId || !transactionId) {
    throw new Error("Apple consumable transaction is incomplete.");
  }

  const creditCents = creditCentsForProduct(productId);
  if (creditCents == null) {
    throw new Error(`Unknown Apple usage pack: ${productId}`);
  }

  const flags = await getUserBillingFlags(userId);
  if (!flags || flags.exempt) {
    throw new Error("This account cannot redeem Apple usage packs.");
  }

  const account = await getBillingAccount(userId);
  if (!account || account.paymentProvider !== "apple") {
    throw new Error("Subscribe with Apple before buying usage credits.");
  }
  if (!["active", "trialing"].includes(account.status)) {
    throw new Error("Apple subscription is not active.");
  }

  const inserted = await recordAppleTransaction({
    transactionId,
    userId,
    productId,
    kind: "consumable",
    creditCents,
  });
  if (!inserted) {
    return {
      creditCents: 0,
      prepaidCreditCents: account.prepaidCreditCents,
    };
  }

  const [updated] = await db
    .update(billingAccount)
    .set({
      prepaidCreditCents: sql`${billingAccount.prepaidCreditCents} + ${creditCents}`,
      updatedAt: new Date(),
    })
    .where(eq(billingAccount.userId, userId))
    .returning({ prepaidCreditCents: billingAccount.prepaidCreditCents });

  return {
    creditCents,
    prepaidCreditCents: updated?.prepaidCreditCents ?? account.prepaidCreditCents + creditCents,
  };
}

export async function applyVerifiedAppleTransaction(input: {
  readonly userId: string;
  readonly signedTransaction: string;
}): Promise<{
  readonly kind: "subscription" | "consumable";
  readonly status?: string;
  readonly creditCents?: number;
  readonly prepaidCreditCents?: number;
}> {
  if (!isAppleIapConfigured() && getAppleAppAppleId() == null) {
    // Verifier can still check JWS with root certs; API key is for Server API.
  }
  const transaction = await verifyAppleTransactionJws(input.signedTransaction);
  const productId = transaction.productId;
  if (!productId) {
    throw new Error("Apple transaction missing productId.");
  }

  if (
    transaction.type === Type.AUTO_RENEWABLE_SUBSCRIPTION ||
    isSubscriptionProduct(productId)
  ) {
    const result = await applyAppleSubscription({
      userId: input.userId,
      transaction,
    });
    return { kind: "subscription", status: result.status };
  }

  if (
    transaction.type === Type.CONSUMABLE ||
    creditCentsForProduct(productId) != null
  ) {
    const result = await applyAppleConsumable({
      userId: input.userId,
      transaction,
    });
    return {
      kind: "consumable",
      creditCents: result.creditCents,
      prepaidCreditCents: result.prepaidCreditCents,
    };
  }

  throw new Error(`Unsupported Apple product: ${productId}`);
}

/**
 * Handle App Store Server Notifications V2.
 */
export async function handleAppleNotification(
  signedPayload: string,
): Promise<void> {
  const notification = await verifyAppleNotificationPayload(signedPayload);
  if (notification.notificationType === NotificationTypeV2.TEST) {
    return;
  }

  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    return;
  }

  const transaction = await verifyAppleTransactionJws(signedTransactionInfo);
  const originalTransactionId = transaction.originalTransactionId;
  const productId = transaction.productId;
  if (!originalTransactionId || !productId) {
    return;
  }

  const account = await findBillingAccountByAppleOriginal(originalTransactionId);
  if (!account) {
    console.warn(
      "[billing/apple] notification for unknown originalTransactionId",
      originalTransactionId,
    );
    return;
  }

  const type = notification.notificationType;

  if (
    type === NotificationTypeV2.EXPIRED ||
    type === NotificationTypeV2.REVOKE ||
    type === NotificationTypeV2.GRACE_PERIOD_EXPIRED ||
    transaction.revocationDate != null
  ) {
    await upsertBillingAccount({
      userId: account.userId,
      stripeCustomerId: account.stripeCustomerId,
      stripeSubscriptionId: account.stripeSubscriptionId,
      status: "expired",
      periodStart: account.periodStart,
      periodEnd: msToDate(transaction.expiresDate) ?? account.periodEnd,
      metronomeCustomerId: account.metronomeCustomerId,
      usageCapCents: account.usageCapCents,
      paymentProvider: "apple",
      appleOriginalTransactionId: originalTransactionId,
      appleProductId: productId,
      appleEnvironment: account.appleEnvironment,
      prepaidCreditCents: account.prepaidCreditCents,
    });
    return;
  }

  if (
    type === NotificationTypeV2.DID_FAIL_TO_RENEW ||
    type === NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS
  ) {
    // Keep access until expiresDate; mark past_due only when already expired.
    const expires = msToDate(transaction.expiresDate);
    if (expires && expires.getTime() <= Date.now()) {
      await upsertBillingAccount({
        userId: account.userId,
        stripeCustomerId: account.stripeCustomerId,
        stripeSubscriptionId: account.stripeSubscriptionId,
        status: "past_due",
        periodStart: account.periodStart,
        periodEnd: expires,
        metronomeCustomerId: account.metronomeCustomerId,
        usageCapCents: account.usageCapCents,
        paymentProvider: "apple",
        appleOriginalTransactionId: originalTransactionId,
        appleProductId: productId,
        appleEnvironment: account.appleEnvironment,
        prepaidCreditCents: account.prepaidCreditCents,
      });
    }
    return;
  }

  if (type === NotificationTypeV2.REFUND) {
    const credit = creditCentsForProduct(productId);
    if (credit != null && transaction.transactionId) {
      const [row] = await db
        .select()
        .from(appleIapTransaction)
        .where(
          and(
            eq(appleIapTransaction.transactionId, transaction.transactionId),
            eq(appleIapTransaction.kind, "consumable"),
          ),
        )
        .limit(1);
      if (row) {
        await db
          .update(billingAccount)
          .set({
            prepaidCreditCents: sql`greatest(0, ${billingAccount.prepaidCreditCents} - ${row.creditCents})`,
            updatedAt: new Date(),
          })
          .where(eq(billingAccount.userId, account.userId));
      }
    } else if (isSubscriptionProduct(productId)) {
      await upsertBillingAccount({
        userId: account.userId,
        stripeCustomerId: account.stripeCustomerId,
        stripeSubscriptionId: account.stripeSubscriptionId,
        status: "expired",
        periodStart: account.periodStart,
        periodEnd: msToDate(transaction.expiresDate) ?? account.periodEnd,
        metronomeCustomerId: account.metronomeCustomerId,
        usageCapCents: account.usageCapCents,
        paymentProvider: "apple",
        appleOriginalTransactionId: originalTransactionId,
        appleProductId: productId,
        appleEnvironment: account.appleEnvironment,
        prepaidCreditCents: account.prepaidCreditCents,
      });
    }
    return;
  }

  if (
    type === NotificationTypeV2.SUBSCRIBED ||
    type === NotificationTypeV2.DID_RENEW ||
    type === NotificationTypeV2.OFFER_REDEEMED ||
    type === NotificationTypeV2.RENEWAL_EXTENDED
  ) {
    await applyAppleSubscription({
      userId: account.userId,
      transaction,
    });
  }
}
