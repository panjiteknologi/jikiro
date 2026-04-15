import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { DOCUMENT_EXTRACTION_TEXT_LIMIT } from "@/lib/attachments";
import { indexProjectTextAsset } from "@/lib/attachments/project-text";
import {
  deleteProjectTextAsset,
  getProjectById,
  getProjectTextAsset,
  upsertProjectTextAsset,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

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

  const asset = await getProjectTextAsset({
    projectId: id,
    userId: session.user.id,
  });

  if (!asset) {
    return NextResponse.json({
      text: null,
      status: null,
      updatedAt: null,
      sizeBytes: 0,
    });
  }

  return NextResponse.json({
    text: asset.extractedText ?? "",
    status: asset.status,
    error: asset.error,
    updatedAt: asset.updatedAt,
    sizeBytes: asset.sizeBytes,
  });
}

const PutSchema = z.object({
  text: z.string().max(DOCUMENT_EXTRACTION_TEXT_LIMIT, {
    message: `Text must be ${DOCUMENT_EXTRACTION_TEXT_LIMIT.toLocaleString()} characters or fewer.`,
  }),
});

export async function PUT(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    const statusCode = firstError?.code === "too_big" ? 413 : 400;
    return NextResponse.json(
      { error: firstError?.message ?? "Invalid text" },
      { status: statusCode }
    );
  }

  const trimmed = parsed.data.text.trim();

  if (trimmed.length === 0) {
    await deleteProjectTextAsset({
      projectId: id,
      userId: session.user.id,
    });
    return NextResponse.json({
      text: null,
      status: null,
      updatedAt: null,
      sizeBytes: 0,
    });
  }

  const asset = await upsertProjectTextAsset({
    projectId: id,
    userId: session.user.id,
    text: parsed.data.text,
  });

  try {
    await indexProjectTextAsset({
      assetId: asset.id,
      projectId: id,
      text: parsed.data.text,
      userId: session.user.id,
      userType: session.user.type,
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to index project text" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    text: parsed.data.text,
    status: "ready",
    error: null,
    updatedAt: asset.updatedAt,
    sizeBytes: asset.sizeBytes,
  });
}
