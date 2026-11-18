import { prisma } from "@/lib/finance/prisma";
import { extractTaxDocumentContent } from "@/lib/finance/tax/document-extract";
import { storeTaxDocumentFile } from "@/lib/finance/tax/document-storage";
import { randomUUID } from "node:crypto";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

function normalizeContentType(fileName: string, contentType: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (contentType && ALLOWED_TYPES.has(contentType)) return contentType;
  return contentType || "application/octet-stream";
}

export async function defaultFilingEntityId() {
  const individual = await prisma.entity.findFirst({
    where: { taxClass: "individual" },
    orderBy: { name: "asc" },
  });
  if (individual) return individual.id;
  const any = await prisma.entity.findFirst({ orderBy: { name: "asc" } });
  if (!any) throw new Error("Create an entity before importing tax documents");
  return any.id;
}

export async function runTaxDocumentExtract(documentId: string) {
  const doc = await prisma.taxDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Tax document not found");

  await prisma.taxDocument.update({
    where: { id: documentId },
    data: { status: "extracting", error: null },
  });

  try {
    const extracted = await extractTaxDocumentContent({
      year: doc.year,
      fileName: doc.fileName,
      contentType: doc.contentType,
      blobUrl: doc.blobUrl,
    });

    const entityId = await defaultFilingEntityId();

    await prisma.taxDocumentLine.deleteMany({
      where: {
        documentId,
        status: { in: ["pending", "accepted", "rejected"] },
        committedActivityId: null,
        committedCapitalGainId: null,
      },
    });

    if (extracted.lines.length > 0) {
      await prisma.taxDocumentLine.createMany({
        data: extracted.lines.map((line) => ({
          documentId,
          status: "pending",
          target: line.target,
          taxCharacter: line.taxCharacter,
          label: line.label || line.sourceBox || "Extracted line",
          amount: line.amount,
          entityId: line.target === "activity" ? entityId : null,
          description: line.description || line.label || line.sourceBox,
          proceeds: line.proceeds,
          basis: line.basis,
          term: line.term,
          date: line.date ? new Date(line.date) : null,
          sourceBox: line.sourceBox,
          rawJson: JSON.stringify(line),
        })),
      });
    }

    await prisma.taxDocument.update({
      where: { id: documentId },
      data: {
        status: "ready",
        formKind: extracted.formKind,
        payerName: extracted.payerName || doc.payerName,
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extract failed";
    await prisma.taxDocument.update({
      where: { id: documentId },
      data: { status: "failed", error: message },
    });
    throw err;
  }
}

export async function createTaxDocumentFromUpload(opts: {
  year: number;
  file: File;
  accountId?: string | null;
  payerName?: string | null;
  formKind?: string | null;
}) {
  const fileName = opts.file.name || "upload";
  const contentType = normalizeContentType(fileName, opts.file.type || "");
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".csv") && !contentType.includes("pdf") && !contentType.includes("csv") && !contentType.includes("text")) {
    throw new Error("Upload a PDF or CSV tax file");
  }

  const bytes = Buffer.from(await opts.file.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("Empty file");
  if (bytes.byteLength > 25 * 1024 * 1024) {
    throw new Error("File too large (max 25MB)");
  }

  const documentId = randomUUID().replace(/-/g, "").slice(0, 24);
  const { blobUrl } = await storeTaxDocumentFile({
    year: opts.year,
    documentId,
    fileName,
    contentType,
    bytes,
  });

  const doc = await prisma.taxDocument.create({
    data: {
      id: documentId,
      year: opts.year,
      formKind: opts.formKind || "other",
      payerName: opts.payerName || null,
      accountId: opts.accountId || null,
      fileName,
      contentType,
      blobUrl,
      status: "uploaded",
    },
  });

  await runTaxDocumentExtract(doc.id);
  return doc.id;
}
