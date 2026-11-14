/**
 * Thin Gmail REST helpers. Tokens come from Vercel Connect via
 * getGmailTokenForMailbox — never stored here.
 */

export type GmailHeader = { readonly name: string; readonly value: string };

export type GmailMessageSummary = {
  readonly id: string;
  readonly threadId: string;
  readonly snippet?: string;
  readonly labelIds?: readonly string[];
  readonly from?: string;
  readonly to?: string;
  readonly subject?: string;
  readonly date?: string;
};

export type GmailThreadSummary = {
  readonly id: string;
  readonly snippet?: string;
  readonly historyId?: string;
  readonly messages?: readonly GmailMessageSummary[];
};

function headerMap(
  headers: readonly GmailHeader[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers ?? []) {
    out[header.name.toLowerCase()] = header.value;
  }
  return out;
}

function summarizeMessage(raw: {
  id?: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: { headers?: GmailHeader[] };
}): GmailMessageSummary {
  const headers = headerMap(raw.payload?.headers);
  return {
    id: raw.id ?? "",
    threadId: raw.threadId ?? "",
    snippet: raw.snippet,
    labelIds: raw.labelIds,
    from: headers.from,
    to: headers.to,
    subject: headers.subject,
    date: headers.date,
  };
}

async function gmailFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new Error(
      `Gmail ${init?.method ?? "GET"} ${path} → ${res.status}${
        res.status === 403
          ? " (missing scope — reconnect the mailbox in Settings → Email)"
          : ""
      }: ${detail}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Primary address for a Gmail grant — used when Connect omits identity claims. */
export async function getGmailProfileEmail(
  token: string,
): Promise<string | null> {
  try {
    const profile = await gmailFetch<{ emailAddress?: string }>(
      token,
      "users/me/profile",
    );
    const email = profile.emailAddress?.trim();
    return email || null;
  } catch {
    return null;
  }
}

export async function searchGmailThreads(
  token: string,
  input: {
    readonly query?: string;
    readonly pageSize?: number;
    readonly pageToken?: string;
    readonly includeSpamTrash?: boolean;
  },
): Promise<{
  readonly threads: readonly GmailThreadSummary[];
  readonly nextPageToken?: string;
  readonly resultSizeEstimate?: number;
}> {
  const params = new URLSearchParams();
  params.set("maxResults", String(Math.min(input.pageSize ?? 20, 50)));
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.pageToken) params.set("pageToken", input.pageToken);
  if (input.includeSpamTrash) params.set("includeSpamTrash", "true");

  const list = await gmailFetch<{
    threads?: { id: string; snippet?: string; historyId?: string }[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(token, `users/me/threads?${params}`);

  const threads: GmailThreadSummary[] = [];
  for (const thread of list.threads ?? []) {
    // Metadata view keeps context small for triage.
    const full = await gmailFetch<{
      id: string;
      snippet?: string;
      historyId?: string;
      messages?: {
        id?: string;
        threadId?: string;
        snippet?: string;
        labelIds?: string[];
        payload?: { headers?: GmailHeader[] };
      }[];
    }>(
      token,
      `users/me/threads/${encodeURIComponent(thread.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    threads.push({
      id: full.id,
      snippet: full.snippet ?? thread.snippet,
      historyId: full.historyId,
      messages: (full.messages ?? []).map(summarizeMessage),
    });
  }

  return {
    threads,
    nextPageToken: list.nextPageToken,
    resultSizeEstimate: list.resultSizeEstimate,
  };
}

export async function getGmailThread(
  token: string,
  threadId: string,
  format: "full" | "metadata" = "full",
): Promise<{
  readonly id: string;
  readonly snippet?: string;
  readonly messages: readonly (GmailMessageSummary & {
    readonly bodyText?: string;
  })[];
}> {
  const path =
    format === "metadata"
      ? `users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
      : `users/me/threads/${encodeURIComponent(threadId)}?format=full`;
  const full = await gmailFetch<{
    id: string;
    snippet?: string;
    messages?: {
      id?: string;
      threadId?: string;
      snippet?: string;
      labelIds?: string[];
      payload?: {
        headers?: GmailHeader[];
        mimeType?: string;
        body?: { data?: string };
        parts?: {
          mimeType?: string;
          body?: { data?: string };
          parts?: { mimeType?: string; body?: { data?: string } }[];
        }[];
      };
    }[];
  }>(token, path);

  return {
    id: full.id,
    snippet: full.snippet,
    messages: (full.messages ?? []).map((message) => ({
      ...summarizeMessage(message),
      bodyText:
        format === "full" ? extractPlainText(message.payload).slice(0, 12_000) : undefined,
    })),
  };
}

export async function getGmailMessage(
  token: string,
  messageId: string,
): Promise<GmailMessageSummary & { readonly bodyText?: string }> {
  const raw = await gmailFetch<{
    id?: string;
    threadId?: string;
    snippet?: string;
    labelIds?: string[];
    payload?: {
      headers?: GmailHeader[];
      mimeType?: string;
      body?: { data?: string };
      parts?: {
        mimeType?: string;
        body?: { data?: string };
        parts?: { mimeType?: string; body?: { data?: string } }[];
      }[];
    };
  }>(
    token,
    `users/me/messages/${encodeURIComponent(messageId)}?format=full`,
  );
  return {
    ...summarizeMessage(raw),
    bodyText: extractPlainText(raw.payload).slice(0, 12_000),
  };
}

export async function listGmailLabels(token: string): Promise<
  readonly {
    readonly id: string;
    readonly name: string;
    readonly type?: string;
  }[]
> {
  const data = await gmailFetch<{
    labels?: { id: string; name: string; type?: string }[];
  }>(token, "users/me/labels");
  return (data.labels ?? []).map((label) => ({
    id: label.id,
    name: label.name,
    type: label.type,
  }));
}

export async function listGmailDrafts(
  token: string,
  pageSize = 20,
): Promise<
  readonly {
    readonly id: string;
    readonly message?: GmailMessageSummary;
  }[]
> {
  const list = await gmailFetch<{
    drafts?: { id: string; message?: { id?: string; threadId?: string } }[];
  }>(
    token,
    `users/me/drafts?maxResults=${Math.min(pageSize, 50)}`,
  );
  const drafts = [];
  for (const draft of list.drafts ?? []) {
    if (!draft.message?.id) {
      drafts.push({ id: draft.id });
      continue;
    }
    const message = await getGmailMessage(token, draft.message.id);
    drafts.push({ id: draft.id, message });
  }
  return drafts;
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function buildRawDraft(input: {
  readonly to: string;
  readonly cc?: string | null;
  readonly bcc?: string | null;
  readonly subject: string;
  readonly body: string;
  readonly inReplyTo?: string | null;
}): string {
  const headers = [
    `To: ${input.to}`,
    ...(input.cc?.trim() ? [`Cc: ${input.cc.trim()}`] : []),
    ...(input.bcc?.trim() ? [`Bcc: ${input.bcc.trim()}`] : []),
    `Subject: ${encodeHeader(input.subject.replace(/[\r\n]+/g, " ").trim())}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    ...(input.inReplyTo?.trim()
      ? [`In-Reply-To: ${input.inReplyTo.trim()}`, `References: ${input.inReplyTo.trim()}`]
      : []),
    "",
    input.body,
  ];
  return Buffer.from(headers.join("\r\n"), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createGmailDraft(
  token: string,
  input: {
    readonly to: string;
    readonly cc?: string | null;
    readonly bcc?: string | null;
    readonly subject: string;
    readonly body: string;
    readonly threadId?: string | null;
    readonly inReplyTo?: string | null;
  },
): Promise<{ readonly id: string; readonly messageId?: string }> {
  const raw = buildRawDraft(input);
  const data = await gmailFetch<{
    id?: string;
    message?: { id?: string };
  }>(token, "users/me/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: input.threadId
        ? { raw, threadId: input.threadId }
        : { raw },
    }),
  });
  return { id: data.id ?? "draft", messageId: data.message?.id };
}

function decodeBody(data: string | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
  } catch {
    return "";
  }
}

function extractPlainText(
  payload:
    | {
        mimeType?: string;
        body?: { data?: string };
        parts?: {
          mimeType?: string;
          body?: { data?: string };
          parts?: { mimeType?: string; body?: { data?: string } }[];
        }[];
      }
    | undefined,
): string {
  if (!payload) return "";
  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType?.startsWith("text/plain") && part.body?.data) {
      return decodeBody(part.body.data);
    }
    for (const nested of part.parts ?? []) {
      if (nested.mimeType?.startsWith("text/plain") && nested.body?.data) {
        return decodeBody(nested.body.data);
      }
    }
  }
  if (payload.body?.data) return decodeBody(payload.body.data);
  return "";
}
