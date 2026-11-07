/** Control of the live collaborative browser: agent drives, or the user takes over. */
export type BrowserControlMode = "agent" | "user";

export type BrowserTabInfo = {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly active: boolean;
};

export type BrowserAction =
  | { readonly action: "navigate"; readonly url: string; readonly tabId?: string }
  | { readonly action: "snapshot"; readonly tabId?: string }
  | {
      readonly action: "click";
      readonly ref: string;
      readonly tabId?: string;
    }
  | {
      readonly action: "type";
      readonly ref: string;
      readonly text: string;
      readonly tabId?: string;
      readonly submit?: boolean;
    }
  | {
      readonly action: "press";
      readonly key: string;
      readonly tabId?: string;
    }
  | {
      readonly action: "scroll";
      readonly direction: "up" | "down";
      readonly tabId?: string;
    }
  | { readonly action: "tabs"; readonly op: "list" }
  | { readonly action: "tabs"; readonly op: "new"; readonly url?: string }
  | { readonly action: "tabs"; readonly op: "select"; readonly tabId: string }
  | { readonly action: "tabs"; readonly op: "close"; readonly tabId: string }
  | { readonly action: "control"; readonly mode: BrowserControlMode }
  | { readonly action: "heartbeat" };

/** Safe result returned to the model — never includes secrets or view URLs. */
export type BrowserActionResult = {
  readonly ok: boolean;
  readonly note?: string;
  readonly controlMode: BrowserControlMode;
  readonly url: string | null;
  readonly title: string | null;
  readonly tabs: readonly BrowserTabInfo[];
  readonly snapshot: string | null;
};

export type WorkspaceFileTab = {
  readonly kind: "file";
  readonly id: string;
  readonly path: string;
  readonly content: string;
  readonly running: boolean;
  readonly note: string | null;
  readonly version: number;
};

export type WorkspacePageTab = {
  readonly kind: "page";
  readonly id: string;
  /** Chromium page id from the control server. */
  readonly pageId: string;
  readonly url: string;
  readonly title: string;
};

export type WorkspaceTab = WorkspaceFileTab | WorkspacePageTab;

export type WorkspaceState = {
  readonly tabs: readonly WorkspaceTab[];
  readonly activeTabId: string | null;
};
