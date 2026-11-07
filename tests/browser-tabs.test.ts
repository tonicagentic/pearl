import assert from "node:assert/strict";
import { test } from "node:test";

import {
  closeTab,
  emptyWorkspace,
  openFileTab,
  openPageTab,
  selectTab,
  syncPageTabs,
} from "../lib/browser/tabs.ts";

test("openFileTab focuses an existing path instead of duplicating", () => {
  let state = emptyWorkspace();
  state = openFileTab(state, {
    id: "a",
    path: "/workspace/draft.md",
    content: "one",
    running: false,
    note: null,
    version: 1,
  });
  state = openFileTab(state, {
    id: "b",
    path: "/workspace/draft.md",
    content: "two",
    running: false,
    note: null,
    version: 2,
  });
  assert.equal(state.tabs.length, 1);
  assert.equal(state.activeTabId, "a");
  assert.equal(state.tabs[0]?.kind, "file");
  if (state.tabs[0]?.kind === "file") {
    assert.equal(state.tabs[0].content, "two");
    assert.equal(state.tabs[0].version, 2);
  }
});

test("openPageTab keeps file tabs and focuses the page", () => {
  let state = emptyWorkspace();
  state = openFileTab(state, {
    id: "file:1",
    path: "/workspace/a.md",
    content: "hi",
    running: false,
    note: null,
    version: 1,
  });
  state = openPageTab(state, {
    pageId: "p1",
    url: "https://example.com",
    title: "Example",
  });
  assert.equal(state.tabs.length, 2);
  assert.equal(state.activeTabId, "page:p1");
  assert.equal(state.tabs[0]?.kind, "file");
  assert.equal(state.tabs[1]?.kind, "page");
});

test("selectTab and closeTab manage focus; closing the last tab empties", () => {
  let state = emptyWorkspace();
  state = openFileTab(state, {
    id: "f1",
    path: "/workspace/a.md",
    content: "a",
    running: false,
    note: null,
    version: 1,
  });
  state = openPageTab(state, {
    pageId: "p1",
    url: "https://example.com",
    title: "Example",
  });
  state = selectTab(state, "f1");
  assert.equal(state.activeTabId, "f1");
  state = closeTab(state, "f1");
  assert.equal(state.tabs.length, 1);
  assert.equal(state.activeTabId, "page:p1");
  state = closeTab(state, "page:p1");
  assert.deepEqual(state, emptyWorkspace());
});

test("syncPageTabs replaces pages and keeps files", () => {
  let state = emptyWorkspace();
  state = openFileTab(state, {
    id: "f1",
    path: "/workspace/a.md",
    content: "a",
    running: false,
    note: null,
    version: 1,
  });
  state = openPageTab(state, {
    pageId: "old",
    url: "https://old.example",
    title: "Old",
  });
  state = syncPageTabs(state, [
    {
      pageId: "p2",
      url: "https://new.example",
      title: "New",
      active: true,
    },
  ]);
  assert.equal(state.tabs.length, 2);
  assert.equal(state.tabs[0]?.kind, "file");
  assert.equal(state.tabs[1]?.kind, "page");
  if (state.tabs[1]?.kind === "page") {
    assert.equal(state.tabs[1].pageId, "p2");
  }
  assert.equal(state.activeTabId, "page:p2");
});
