import type { ChatListItem } from "../src/chats-client";
import {
  appendChatListPage,
  applyChatListPage,
  applyChatMeta,
  applyChatPresence,
  isCurrentGeneration,
  sameChatRows,
} from "../src/chat-list-reducer";

function row(
  id: string,
  extras: Partial<ChatListItem> = {},
): ChatListItem {
  return {
    id,
    title: extras.title ?? id,
    updatedAt: extras.updatedAt ?? "2026-01-01T00:00:00.000Z",
    presence: extras.presence ?? "idle",
    waitingForInput: extras.waitingForInput ?? false,
    projectId: extras.projectId ?? null,
  };
}

describe("sameChatRows", () => {
  it("keeps identity when fields match", () => {
    const a = [row("1"), row("2")];
    const b = [row("1"), row("2")];
    expect(sameChatRows(a, b)).toBe(true);
  });

  it("detects presence changes", () => {
    const a = [row("1", { presence: "idle" })];
    const b = [row("1", { presence: "waiting", waitingForInput: true })];
    expect(sameChatRows(a, b)).toBe(false);
  });
});

describe("applyChatListPage", () => {
  it("replaces on a full reload", () => {
    const current = [row("old")];
    const page = [row("a"), row("b")];
    expect(applyChatListPage({ current, page, silent: false })).toEqual(page);
  });

  it("returns the same array when a full reload matches", () => {
    const current = [row("a")];
    const page = [row("a")];
    expect(applyChatListPage({ current, page, silent: false })).toBe(current);
  });

  it("merges silent page-1 into scrolled pages", () => {
    const current = [
      row("a", { presence: "idle" }),
      row("b"),
      row("c"),
    ];
    const page = [row("a", { presence: "working" }), row("b")];
    const next = applyChatListPage({ current, page, silent: true });
    expect(next.map((chat) => chat.id)).toEqual(["a", "b", "c"]);
    expect(next[0]?.presence).toBe("working");
  });
});

describe("appendChatListPage", () => {
  it("dedupes ids already in the list", () => {
    const current = [row("a"), row("b")];
    const page = [row("b"), row("c")];
    expect(appendChatListPage(current, page).map((chat) => chat.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns the same array when every id is known", () => {
    const current = [row("a")];
    expect(appendChatListPage(current, [row("a")])).toBe(current);
  });
});

describe("isCurrentGeneration", () => {
  it("drops stale stamps", () => {
    expect(isCurrentGeneration(1, 2)).toBe(false);
    expect(isCurrentGeneration(3, 3)).toBe(true);
  });
});

describe("applyChatPresence", () => {
  it("moves live presence to the top and bumps updatedAt", () => {
    const current = [
      row("a", { presence: "idle" }),
      row("b", { presence: "idle", updatedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const next = applyChatPresence(
      current,
      "b",
      "waiting",
      "2026-01-02T00:00:00.000Z",
    );
    expect(next.map((chat) => chat.id)).toEqual(["b", "a"]);
    expect(next[0]?.presence).toBe("waiting");
    expect(next[0]?.waitingForInput).toBe(true);
    expect(next[0]?.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("keeps identity when nothing changed", () => {
    const current = [row("a", { presence: "working" })];
    expect(applyChatPresence(current, "a", "working")).toBe(current);
  });
});

describe("applyChatMeta", () => {
  it("patches title and reorders on a newer updatedAt", () => {
    const current = [row("a"), row("b", { title: "Old" })];
    const next = applyChatMeta(current, "b", {
      title: "New",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(next[0]?.id).toBe("b");
    expect(next[0]?.title).toBe("New");
  });
});
