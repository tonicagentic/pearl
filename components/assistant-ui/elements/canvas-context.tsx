"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Page-level canvas state: the document currently shown beside the thread.
// The write_file tool renderer claims the canvas while its call streams and
// updates the content as the model writes; the chat layout reads it to split
// the thread into a rail.
export type CanvasDocument = {
  /** Stable id of the tool call that owns this document. */
  readonly id: string;
  readonly path: string;
  readonly content: string;
  readonly running: boolean;
  readonly note: string | null;
  /** Session-scoped revision count for this path (write_file + edit_file). */
  readonly version: number;
};

// Session-scoped revision counters per file path. Each completed write_file
// or edit_file call bumps the count, so the canvas header shows a real
// revision number as the draft iterates. Resets on reload — the durable
// history lives in the agent_file_revision table.
const pathVersions = new Map<string, number>();
const callVersions = new Map<string, number>();

// Idempotent per tool call: a streaming call renders many times before it
// completes, and StrictMode renders twice — the first completed render for a
// call id claims the next version, later renders reuse it.
export function versionForCall(
  callId: string,
  path: string,
  completed: boolean,
): number {
  if (!completed) {
    return pathVersions.get(path) ?? 1;
  }

  const assigned = callVersions.get(callId);
  if (assigned !== undefined) {
    return assigned;
  }

  const next = (pathVersions.get(path) ?? 0) + 1;
  pathVersions.set(path, next);
  callVersions.set(callId, next);
  return next;
}

export function pathVersion(path: string): number {
  return pathVersions.get(path) ?? 1;
}

type CanvasContextValue = {
  readonly document: CanvasDocument | null;
  openDocument: (doc: CanvasDocument) => void;
  updateDocument: (
    id: string,
    patch: Partial<Omit<CanvasDocument, "id">>,
  ) => void;
  closeDocument: () => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [document, setDocument] = useState<CanvasDocument | null>(null);

  const openDocument = useCallback((doc: CanvasDocument) => {
    setDocument(doc);
  }, []);

  const updateDocument = useCallback(
    (id: string, patch: Partial<Omit<CanvasDocument, "id">>) => {
      setDocument((prev) =>
        prev && prev.id === id ? { ...prev, ...patch } : prev,
      );
    },
    [],
  );

  const closeDocument = useCallback(() => {
    setDocument(null);
  }, []);

  const value = useMemo(
    () => ({ document, openDocument, updateDocument, closeDocument }),
    [document, openDocument, updateDocument, closeDocument],
  );

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);

  if (!ctx) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }

  return ctx;
}
