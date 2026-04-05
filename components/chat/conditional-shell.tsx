"use client";

import { usePathname } from "next/navigation";
import { ChatShell } from "./shell";

export function ConditionalChatShell() {
  const pathname = usePathname();
  const isChatRoute = pathname === "/" || pathname?.startsWith("/chat/");
  if (!isChatRoute) return null;
  return <ChatShell />;
}
