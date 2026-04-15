import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectChatsWithLastMessage,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const MAX_PREVIEW_LENGTH = 200;

function extractPreviewText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";

  const texts: string[] = [];
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type: string }).type === "text" &&
      "text" in part &&
      typeof (part as { text: unknown }).text === "string"
    ) {
      texts.push((part as { text: string }).text);
    }
  }

  return texts.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_PREVIEW_LENGTH);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const { id } = await params;

  const project = await getProjectById({ id, userId: session.user.id });
  if (!project) {
    return new ChatbotError("not_found:project").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "50", 10), 1),
    100
  );

  const chats = await getProjectChatsWithLastMessage({
    userId: session.user.id,
    projectId: id,
    limit,
  });

  return Response.json(
    chats.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      visibility: c.visibility,
      projectId: c.projectId,
      userId: c.userId,
      lastMessage: c.lastMessage
        ? {
            role: c.lastMessage.role,
            preview: extractPreviewText(c.lastMessage.parts),
            createdAt: c.lastMessage.createdAt,
          }
        : null,
    }))
  );
}
