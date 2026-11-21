import { putPrivateBlob } from "@/lib/blob/private";
import { NextResponse } from "next/server";

import {
  artifactsPrefix,
  normalizeArtifactSlug,
} from "@/agent/lib/artifacts";
import { contentTypeForWorkspacePath } from "@/agent/lib/design-files";
import {
  dispositionFilename,
  pathsMatchWorkspaceFile,
  sanitizeWorkspaceLookupPath,
} from "@/lib/design/chat-file-url";
import { isContentUrl } from "@/lib/design/file-preview";
import {
  getAgentFile,
  getChatForUser,
  listAgentFiles,
  upsertAgentFile,
} from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

function fileResponseHeaders(args: {
  readonly path: string;
  readonly download: boolean;
}): HeadersInit {
  const filename = dispositionFilename(args.path);
  const type = contentTypeForWorkspacePath(args.path);
  const disposition = args.download
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;
  return {
    "content-type": type,
    "content-disposition": disposition,
  };
}

function isRemoteContentUrl(content: string): boolean {
  return isContentUrl(content) && /^https?:\/\//i.test(content.trim());
}

async function resolveFileByPath(
  chatId: string,
  path: string,
): Promise<{ readonly id: string; readonly path: string } | null> {
  const files = await listAgentFiles(chatId);
  const match = files.find((entry) =>
    pathsMatchWorkspaceFile(entry.path, path),
  );
  return match ? { id: match.id, path: match.path } : null;
}

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ files: [] }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ files: [] }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatForUser(id, viewer.id);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const fileId = url.searchParams.get("fileId");
  const pathParam = sanitizeWorkspaceLookupPath(url.searchParams.get("path"));

  // fileId: legacy content fetch for chat clients — always return the stored
  // string (SVG/markdown body, or a signed Blob URL for binary paths).
  if (fileId) {
    const file = await getAgentFile(id, fileId);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (download && isRemoteContentUrl(file.content)) {
      return NextResponse.redirect(file.content.trim(), 302);
    }

    return new NextResponse(file.content, {
      headers: download
        ? fileResponseHeaders({ path: file.path, download: true })
        : {
            "content-type": "text/plain; charset=utf-8",
            "content-disposition": `inline; filename="${dispositionFilename(file.path)}"`,
          },
    });
  }

  // path: browser-facing URL for <img src> and right-click Save.
  if (pathParam) {
    const match = await resolveFileByPath(id, pathParam);
    if (!match) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const file = await getAgentFile(id, match.id);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (isRemoteContentUrl(file.content)) {
      return NextResponse.redirect(file.content.trim(), 302);
    }

    return new NextResponse(file.content, {
      headers: fileResponseHeaders({
        path: file.path,
        download,
      }),
    });
  }

  const files = await listAgentFiles(id);

  return NextResponse.json({ files });
}

/**
 * Persist a user edit from the mobile file canvas into the chat's durable
 * agent_file mirror (Postgres + Blob when available). Does not write the live
 * eve sandbox mid-session.
 */
export async function PUT(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const chat = await getChatForUser(id, viewer.id);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const path =
    body &&
    typeof body === "object" &&
    typeof (body as { path?: unknown }).path === "string"
      ? (body as { path: string }).path.trim()
      : "";
  const content =
    body &&
    typeof body === "object" &&
    typeof (body as { content?: unknown }).content === "string"
      ? (body as { content: string }).content
      : null;

  if (!path || content === null) {
    return NextResponse.json(
      { error: "path and content are required" },
      { status: 400 },
    );
  }

  if (path.includes("\0") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let blobPathname: string | undefined;
  try {
    const prefix = artifactsPrefix({
      principalId: viewer.id,
      principalType: "user",
    });
    if (prefix) {
      const slug = normalizeArtifactSlug(path);
      if (slug) {
        const blob = await putPrivateBlob(`${prefix}${slug}`, content, {
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: contentTypeForWorkspacePath(path),
          signGet: false,
        });
        blobPathname = blob.pathname || `${prefix}${slug}`;
      }
    }
  } catch {
    blobPathname = undefined;
  }

  await upsertAgentFile({
    chatId: id,
    path,
    content,
    blobPathname,
  });

  return NextResponse.json({
    ok: true,
    path,
    byteLength: Buffer.byteLength(content, "utf8"),
  });
}
