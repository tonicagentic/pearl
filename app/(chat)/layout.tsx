import type { ReactNode } from "react";
import { ChatAppShell } from "@/app/_components/chat-app-shell";

export default function ChatLayout({ children }: { readonly children: ReactNode }) {
  return <ChatAppShell>{children}</ChatAppShell>;
}
