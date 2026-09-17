"use client";

import { useCallback, useEffect, useState } from "react";
import { AssistantChatSurface } from "@/app/_components/assistant-chat";
import { ErrorToast } from "@/app/_components/error-toast";
import { useChatShell } from "@/app/_components/chat-shell-context";

export function HomeChatPage() {
  const { setActiveChatId, setupStatus } = useChatShell();
  const [clientError, setClientError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const toastError = clientError && dismissedError !== clientError ? clientError : null;

  useEffect(() => {
    setActiveChatId(null);
  }, [setActiveChatId]);

  const handleChatCreated = useCallback((chatId: string) => {
    // Keep the surface mounted (the runtime owns the in-flight turn) while the
    // URL moves to the durable chat route.
    window.history.replaceState(null, "", `/chat/${chatId}`);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toastError ? (
        <ErrorToast
          message={toastError}
          onDismiss={() => setDismissedError(toastError)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <AssistantChatSurface
          activeChat={null}
          chatId={null}
          onChatCreated={handleChatCreated}
        />
      </div>
    </div>
  );
}
