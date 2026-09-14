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
};

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
