import { authedJson, authedVoid } from "./http";

export type NoteSummaryDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly title: string;
  readonly updatedAt: string;
};

export type NoteDto = {
  readonly id: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly title: string;
  readonly markdown: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function fetchAllNotes(): Promise<readonly NoteSummaryDto[]> {
  const data = await authedJson<{ notes: NoteSummaryDto[] }>("/api/notes");
  return data.notes;
}

export async function fetchNote(noteId: string): Promise<NoteDto> {
  const data = await authedJson<{ note: NoteDto }>(
    `/api/notes/${encodeURIComponent(noteId)}`,
  );
  return data.note;
}

export async function createNoteRequest(input: {
  readonly title: string;
  readonly markdown?: string;
  readonly projectId?: string | null;
}): Promise<NoteDto> {
  const data = await authedJson<{ note: NoteDto }>("/api/notes", {
    method: "POST",
    json: input,
  });
  return data.note;
}

export async function updateNoteRequest(
  noteId: string,
  input: {
    readonly title?: string;
    readonly markdown?: string;
    readonly projectId?: string | null;
  },
): Promise<NoteDto> {
  const data = await authedJson<{ note: NoteDto }>(
    `/api/notes/${encodeURIComponent(noteId)}`,
    { method: "PATCH", json: input },
  );
  return data.note;
}

export async function deleteNoteRequest(noteId: string): Promise<void> {
  await authedVoid(`/api/notes/${encodeURIComponent(noteId)}`, {
    method: "DELETE",
  });
}