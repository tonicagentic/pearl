// Chat thread persistence for the mobile app: the same durable chats the web
// app shows, over the web app's REST surface, with the better-auth session
// credential from the eve transport.

import type { ClientSessionState, SessionStreamEvent } from 'eve/client';

import type { LiveSpokenDraft, SpokenTurn } from '../../lib/chat/spoken-turns';
import type {
  ActiveChat,
  ChatListItem,
  ChatPresence,
  ChatSearchHit,
  CustomAgentRef,
} from '../../lib/chat/shared-client-types';
import { AGENT_URL, getAuthCookie } from './eve-transport';
import { sessionInvalid } from './session-store';

export type {
  ActiveChat,
  ChatListItem,
  ChatPresence,
  ChatSearchHit,
  CustomAgentRef,
} from '../../lib/chat/shared-client-types';

export type AgentFileMeta = {
  readonly id: string;
  readonly path: string;
  readonly byteLength: number;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ComputerPreview = {
  readonly kind: "dev-server" | "expo-simulator";
  readonly url: string;
  readonly label: string;
  readonly repoFullName: string | null;
};

/** Aggregate Computer-tab snapshot (no browser mint / secrets). */
export type ComputerState = {
  readonly session: ClientSessionState | null;
  readonly waitingForInput: boolean;
  readonly files: readonly AgentFileMeta[];
  readonly browser: { readonly active: boolean };
  readonly previews?: readonly ComputerPreview[];
};

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();

  return {
    'content-type': 'application/json',
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

export async function listChats(
  cursor?: string | null,
): Promise<{ chats: ChatListItem[]; nextCursor: string | null }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await fetch(`${AGENT_URL}/api/chats${query}`, {
    headers: authHeaders(),
    // Don't follow HTML login redirects from a misconfigured agent host.
    redirect: 'manual',
  });

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Failed to load chats (redirect ${response.status}).`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to load chats (${response.status}).`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Failed to load chats (unexpected response).');
  }

  return (await response.json()) as {
    chats: ChatListItem[];
    nextCursor: string | null;
  };
}

/** Search all chats by title or message/event text. */
export async function searchChats(
  query: string,
): Promise<readonly ChatSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const response = await fetch(
    `${AGENT_URL}/api/chats/search?q=${encodeURIComponent(q)}`,
    {
      headers: authHeaders(),
      redirect: "manual",
    },
  );

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Failed to search chats (redirect ${response.status}).`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to search chats (${response.status}).`);
  }

  const data = (await response.json()) as { chats?: ChatSearchHit[] };
  return data.chats ?? [];
}

export async function getChat(id: string): Promise<ActiveChat | null> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(id)}`,
    { headers: authHeaders() },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to load the chat (${response.status}).`);
  }

  const data = (await response.json()) as { chat: ActiveChat | null };
  if (!data.chat) return null;
  const events = data.chat.events ?? [];
  return {
    ...data.chat,
    customAgent: data.chat.customAgent ?? null,
    spokenTurns: data.chat.spokenTurns ?? [],
    quickTurns: data.chat.quickTurns ?? [],
    nextEventIndex: data.chat.nextEventIndex ?? events.length,
    hydratedFromIndex: data.chat.hydratedFromIndex ?? 0,
  };
}

/** Durable session cursor, files, and browser-active flag for the Computer tab. */
export async function fetchComputerState(
  chatId: string,
): Promise<ComputerState> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/computer`,
    {
      headers: authHeaders(),
      redirect: "manual",
    },
  );

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Failed to load computer state (redirect ${response.status}).`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to load computer state (${response.status}).`);
  }

  return (await response.json()) as ComputerState;
}

/** Persist live voice turns without starting a Pearl turn. */
export async function saveSpokenTurns(
  chatId: string,
  turns: readonly LiveSpokenDraft[],
): Promise<readonly SpokenTurn[]> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/spoken-turns`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ turns }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
      throw new Error("Sign in to continue.");
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to save the live conversation (${response.status}).`);
  }

  const data = (await response.json()) as { spokenTurns?: SpokenTurn[] };
  return data.spokenTurns ?? [];
}

export async function createChat(
  pendingUserMessage?: string,
  projectId?: string | null,
): Promise<{
  id: string;
  title: string;
  updatedAt: string;
  projectId?: string | null;
}> {
  const response = await fetch(`${AGENT_URL}/api/chats`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ pendingUserMessage, projectId }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
      throw new Error("Sign in to continue.");
    }
    throw new Error(`Failed to create the chat (${response.status}).`);
  }

  const data = (await response.json()) as {
    chat: {
      id: string;
      title: string;
      updatedAt: string;
      projectId?: string | null;
    };
  };

  return data.chat;
}

/** Attach or detach an existing chat to/from a project. */
export async function setChatProject(
  chatId: string,
  projectId: string | null,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ projectId }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      body.error ?? `Failed to update chat project (${response.status}).`,
    );
  }
}

/** Attach an existing chat to a project (Plan mode / project chats). */
export async function attachChatToProject(
  chatId: string,
  projectId: string,
): Promise<void> {
  await setChatProject(chatId, projectId);
}

/** Rename a stored chat. */
export async function renameChat(
  chatId: string,
  title: string,
): Promise<{ readonly title: string; readonly updatedAt: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ title }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Failed to rename chat (${response.status}).`);
  }

  const data = (await response.json()) as {
    title?: string;
    updatedAt?: string;
  };

  return {
    title: data.title ?? title.trim(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export class ChatPersistError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatPersistError";
    this.status = status;
  }
}

export async function appendChatEvents(
  chatId: string,
  events: readonly { readonly event: SessionStreamEvent; readonly eventIndex: number }[],
  options?: {
    readonly session?: ClientSessionState;
    readonly upgradeTitleFrom?: string;
  },
): Promise<{ readonly ok: true; readonly title?: string }> {
  if (events.length === 0 && !options?.session && !options?.upgradeTitleFrom) {
    return { ok: true };
  }
  const response = await fetch(`${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      ...(events.length > 0 ? { append: events } : {}),
      ...(options?.session ? { session: options.session } : {}),
      ...(options?.upgradeTitleFrom
        ? { upgradeTitleFrom: options.upgradeTitleFrom }
        : {}),
    }),
  });
  if (!response.ok) {
    if (response.status === 401) sessionInvalid();
    throw new ChatPersistError(
      `Failed to save chat events (${response.status}).`,
      response.status,
    );
  }
  const data = (await response.json().catch(() => ({ ok: true }))) as {
    readonly ok?: boolean;
    readonly title?: unknown;
  };
  return {
    ok: true,
    ...(typeof data.title === "string" ? { title: data.title } : {}),
  };
}

export async function markPendingChatMessage(chatId: string, message: string): Promise<void> {
  const response = await fetch(`${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ pendingUserMessage: message }),
  });
  if (!response.ok) {
    if (response.status === 401) sessionInvalid();
    throw new Error(`Failed to save pending message (${response.status}).`);
  }
}

/** Stamp the chat as read so home-list unread clears across devices. */
export async function markChatRead(chatId: string): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ markRead: true }),
    },
  );
  if (!response.ok) {
    if (response.status === 401) sessionInvalid();
    throw new Error(`Failed to mark chat read (${response.status}).`);
  }
}

export async function saveChatSnapshot(
  chatId: string,
  events: readonly SessionStreamEvent[],
  session: ClientSessionState | undefined,
): Promise<{ readonly ok: true; readonly title?: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ events, session }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new ChatPersistError(
      `Failed to save the chat (${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json().catch(() => ({ ok: true }))) as {
    readonly ok?: boolean;
    readonly title?: unknown;
  };
  return {
    ok: true,
    ...(typeof data.title === "string" ? { title: data.title } : {}),
  };
}

export async function saveChatSession(
  chatId: string,
  session: ClientSessionState,
  options?: { readonly upgradeTitleFrom?: string },
): Promise<{ readonly ok: true; readonly title?: string }> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        session,
        ...(options?.upgradeTitleFrom
          ? { upgradeTitleFrom: options.upgradeTitleFrom }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new ChatPersistError(
      `Failed to save the chat session (${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json().catch(() => ({ ok: true }))) as {
    readonly ok?: boolean;
    readonly title?: unknown;
  };
  return {
    ok: true,
    ...(typeof data.title === "string" ? { title: data.title } : {}),
  };
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to delete the chat (${response.status}).`);
  }
}

export type SendLimitResult =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly message: string;
      readonly retryAfter: number;
    };

/** prepareSend rate limit — same window as web checkSendLimitAction. */
export async function checkSendLimit(input?: {
  readonly message?: string;
}): Promise<SendLimitResult> {
  const response = await fetch(`${AGENT_URL}/api/chats/send-limit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(
      input?.message !== undefined ? { message: input.message } : {},
    ),
  });
  if (response.status === 401) {
    sessionInvalid();
    throw new Error("Sign in to send messages.");
  }
  if (!response.ok) {
    throw new Error(`Could not check send limit (${response.status}).`);
  }
  return (await response.json()) as SendLimitResult;
}
