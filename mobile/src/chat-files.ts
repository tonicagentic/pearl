import { AGENT_URL, getAuthCookie } from "./eve-transport";

export type ChatFileEntry = {
  readonly id: string;
  readonly path: string;
  readonly byteLength?: number;
  readonly version?: number;
};

const listCache = new Map<string, Promise<readonly ChatFileEntry[]>>();
const contentCache = new Map<string, Promise<string | null>>();

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

/** List saved files for a chat (cached per chat id). */
export async function listChatFiles(
  chatId: string,
): Promise<readonly ChatFileEntry[]> {
  const cached = listCache.get(chatId);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const res = await fetch(
        `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/files`,
        { headers: authHeaders() },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        files?: readonly ChatFileEntry[];
      };
      return data.files ?? [];
    } catch {
      return [];
    }
  })();
  listCache.set(chatId, promise);
  return promise;
}

/** Resolve workspace path to file content for a chat. */
export async function fetchChatFileContent(
  chatId: string,
  path: string,
): Promise<string | null> {
  const key = `${chatId}:${path}`;
  const cached = contentCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const files = await listChatFiles(chatId);
    const file = files.find(
      (entry) => entry.path === path || entry.path.endsWith(`/${path}`),
    );
    if (!file) return null;
    try {
      const res = await fetch(
        `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/files?fileId=${encodeURIComponent(file.id)}`,
        { headers: authHeaders() },
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  })();
  contentCache.set(key, promise);
  return promise;
}

/** Drop caches when the active chat changes or files are rewritten. */
export function invalidateChatFileCaches(chatId?: string): void {
  if (!chatId) {
    listCache.clear();
    contentCache.clear();
    return;
  }
  listCache.delete(chatId);
  for (const key of contentCache.keys()) {
    if (key.startsWith(`${chatId}:`)) contentCache.delete(key);
  }
}

/** Persist user canvas edits to the chat's agent_file mirror. */
export async function saveChatFile(
  chatId: string,
  path: string,
  content: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/files`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ path, content }),
      },
    );
    if (!res.ok) return false;
    invalidateChatFileCaches(chatId);
    return true;
  } catch {
    return false;
  }
}
