"use client";

import { usePathname } from "next/navigation";
import { ChatShell } from "./shell";

const PROJECT_NEW_ROUTE_REGEX = /^\/projects\/[^/]+\/new$/;

export function ConditionalChatShell() {
  const pathname = usePathname();
  const isChatRoute =
    pathname === "/" ||
    pathname?.startsWith("/chat/") ||
    PROJECT_NEW_ROUTE_REGEX.test(pathname ?? "");
  if (!isChatRoute) return null;
  return <ChatShell />;
}
