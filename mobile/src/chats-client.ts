// Chat thread persistence for the mobile app: the same durable chats the web
// app shows, over the web app's REST surface, with the better-auth session
// credential from the eve transport.

import type { ClientSessionState, SessionStreamEvent } from 'eve/client';

import { AGENT_URL, getAuthCookie } from './eve-transport';
import { sessionInvalid } from './session-store';

export type ChatListItem = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly projectId?: string | null;
  readonly waitingForInput?: boolean;
};

export type ActiveChat = {
  readonly events: readonly SessionStreamEvent[];
  readonly id: string;
  readonly pendingUserMessage: string | null;
  readonly projectId: string | null;
  readonly session: ClientSessionState | undefined;
  readonly title: string;
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

  return data.chat;
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

/** Attach an existing chat to a project (Plan mode / project chats). */
export async function attachChatToProject(
  chatId: string,
  projectId: string,
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
      body.error ?? `Failed to attach chat (${response.status}).`,
    );
  }
}

export async function appendChatEvents(
  chatId: string,
  events: readonly { readonly event: SessionStreamEvent; readonly eventIndex: number }[],
): Promise<void> {
  if (events.length === 0) return;
  const response = await fetch(`${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ append: events }),
  });
  if (!response.ok) {
    if (response.status === 401) sessionInvalid();
    throw new Error(`Failed to save chat events (${response.status}).`);
  }
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

export async function saveChatSnapshot(
  chatId: string,
  events: readonly SessionStreamEvent[],
  session: ClientSessionState | undefined,
): Promise<void> {
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
    throw new Error(`Failed to save the chat (${response.status}).`);
  }
}

export async function saveChatSession(
  chatId: string,
  session: ClientSessionState,
): Promise<void> {
  const response = await fetch(
    `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/sync`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ session }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to save the chat session (${response.status}).`);
  }
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
