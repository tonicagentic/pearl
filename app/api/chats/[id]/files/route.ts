import { NextResponse } from "next/server";
import { getAgentFile, getChatForUser, listAgentFiles } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

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
  const fileId = url.searchParams.get("fileId");

  if (fileId) {
    const file = await getAgentFile(id, fileId);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return new NextResponse(file.content, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${file.path.split("/").pop() || "file"}"`,
      },
    });
  }

  const files = await listAgentFiles(id);

  return NextResponse.json({ files });
}
