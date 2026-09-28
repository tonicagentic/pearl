"use client";

import { useEffect, useState } from "react";

// Live elapsed badge for a streaming view (docs: elements/thinking-indicator —
// there is no runtime selector for "seconds so far": metadata.timing only
// finalizes once the message stops streaming, so a live badge needs its own
// timer). Starts when `active` flips true, resets when it flips false. The
// effect keeps the Cache Components shell deterministic (no wall clock at
// render).
export function useElapsedLabel(active: boolean) {
  const [label, setLabel] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      setLabel(undefined);
      return;
    }
    const start = Date.now();
    setLabel("0s");
    const id = setInterval(() => {
      setLabel(`${Math.round((Date.now() - start) / 1000)}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);
  return label;
}
