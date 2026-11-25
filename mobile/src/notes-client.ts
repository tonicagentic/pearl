import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

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

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  return body.error ?? `Request failed (${response.status}).`;
}

function handleAuth(response: Response): void {
  if (response.status === 401) {
    sessionInvalid();
  }
}

export async function fetchAllNotes(): Promise<readonly NoteSummaryDto[]> {
  const response = await fetch(`${AGENT_URL}/api/notes`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { notes: NoteSummaryDto[] };
  return data.notes;
}

export async function fetchNote(noteId: string): Promise<NoteDto> {
  const response = await fetch(
    `${AGENT_URL}/api/notes/${encodeURIComponent(noteId)}`,
    { headers: authHeaders() },
  );
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { note: NoteDto };
  return data.note;
}

export async function createNoteRequest(input: {
  readonly title: string;
  readonly markdown?: string;
  readonly projectId?: string | null;
}): Promise<NoteDto> {
  const response = await fetch(`${AGENT_URL}/api/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { note: NoteDto };
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
  const response = await fetch(
    `${AGENT_URL}/api/notes/${encodeURIComponent(noteId)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
  const data = (await response.json()) as { note: NoteDto };
  return data.note;
}

export async function deleteNoteRequest(noteId: string): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/notes/${encodeURIComponent(noteId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!response.ok) {
    handleAuth(response);
    throw new Error(await readError(response));
  }
}
