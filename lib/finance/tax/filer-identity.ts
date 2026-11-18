import { decryptSecret } from "@/lib/finance/crypto";
import { prisma } from "@/lib/finance/prisma";
import type { TaxFilerIdentity } from "./types";

export function maskSsn(ssn: string | null | undefined): string {
  const digits = (ssn ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `•••-••-${digits.slice(-4)}`;
}

export function last4FromEnc(ssnEnc: string | null | undefined): string {
  if (!ssnEnc) return "";
  try {
    return maskSsn(decryptSecret(ssnEnc));
  } catch {
    return "";
  }
}

export async function loadFilerIdentity(): Promise<TaxFilerIdentity | null> {
  const profile = await prisma.taxProfile.findFirst();
  if (!profile) return null;

  let ssn = "";
  let spouseSsn = "";
  try {
    if (profile.ssnEnc) ssn = decryptSecret(profile.ssnEnc);
  } catch {
    ssn = "";
  }
  try {
    if (profile.spouseSsnEnc) spouseSsn = decryptSecret(profile.spouseSsnEnc);
  } catch {
    spouseSsn = "";
  }

  return {
    legalName: profile.legalName ?? "",
    occupation: profile.occupation ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? profile.residentState ?? "CA",
    zip: profile.zip ?? "",
    phone: profile.phone ?? "",
    ssn,
    spouseLegalName: profile.spouseLegalName ?? "",
    spouseSsn,
  };
}

export function formatSsnDisplay(ssn: string): string {
  const d = ssn.replace(/\D/g, "");
  if (d.length !== 9) return ssn;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}
