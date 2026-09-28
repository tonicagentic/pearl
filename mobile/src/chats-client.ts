// Chat thread persistence for the mobile app: the same durable chats the web
// app shows, over the web app's REST surface, with the better-auth session
// cookie from the eve transport.

import type { ClientSessionState, MessageStreamEvent } from 'eve/client';

import { AGENT_URL, getAuthCookie } from './eve-transport';
import { sessionInvalid } from './session-store';

export type ChatListItem = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type ActiveChat = {
  readonly events: readonly MessageStreamEvent[];
  readonly id: string;
  readonly pendingUserMessage: string | null;
  readonly session: ClientSessionState | undefined;
  readonly title: string;
};

function authHeaders(): Record<string, string> {
  const cookie = getAuthCookie();

  return {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  };
}

export async function listChats(
  cursor?: string | null,
): Promise<{ chats: ChatListItem[]; nextCursor: string | null }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await fetch(`${AGENT_URL}/api/chats${query}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to load chats (${response.status}).`);
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
): Promise<{ id: string; title: string; updatedAt: string }> {
  const response = await fetch(`${AGENT_URL}/api/chats`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ pendingUserMessage }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionInvalid();
    }
    throw new Error(`Failed to create the chat (${response.status}).`);
  }

  const data = (await response.json()) as { chat: { id: string; title: string; updatedAt: string } };

  return data.chat;
}

export async function saveChatSnapshot(
  chatId: string,
  events: readonly MessageStreamEvent[],
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
