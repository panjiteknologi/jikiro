import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { deleteProject, getProjectById, updateProject } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { deleteFilesFromS3BestEffort } from "@/lib/storage/s3";

export async function GET(
  _request: Request,
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

  return Response.json(project);
}

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().max(4000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const { id } = await params;

  const existing = await getProjectById({ id, userId: session.user.id });

  if (!existing) {
    return new ChatbotError("not_found:project").toResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new ChatbotError("bad_request:project").toResponse();
  }

  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return new ChatbotError("bad_request:project").toResponse();
  }

  const updated = await updateProject({
    id,
    userId: session.user.id,
    name: parsed.data.name,
    systemPrompt: parsed.data.systemPrompt,
  });

  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const { id } = await params;

  const existing = await getProjectById({ id, userId: session.user.id });

  if (!existing) {
    return new ChatbotError("not_found:project").toResponse();
  }

  const { storageKeysToDelete } = await deleteProject({
    id,
    userId: session.user.id,
  });

  if (storageKeysToDelete.length > 0) {
    await deleteFilesFromS3BestEffort({
      keys: storageKeysToDelete,
      context: {
        userId: session.user.id,
        projectId: id,
        operation: "delete-project",
      },
    });
  }

  return new Response(null, { status: 204 });
}
