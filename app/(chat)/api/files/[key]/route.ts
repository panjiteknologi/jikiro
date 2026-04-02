import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { deleteAttachmentAssetByStorageKey } from "@/lib/db/queries";
import {
  decodeStorageKey,
  deleteFileFromS3,
  getChatUploadPrefix,
  getFileBufferFromS3,
} from "@/lib/storage/s3";

function sanitizeHeaderFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, "_");
}

function getFilenameFromKey(key: string) {
  const lastSegment = key.split("/").at(-1) ?? "file";
  const [, ...rest] = lastSegment.split("-");

  return rest.length > 0 ? rest.join("-") : lastSegment;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let storageKey: string;

  try {
    const resolvedParams = await params;
    storageKey = decodeStorageKey(resolvedParams.key);
  } catch {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  if (!storageKey.startsWith(getChatUploadPrefix(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { buffer, contentType, metadata } = await getFileBufferFromS3(
      storageKey
    );
    const filename = sanitizeHeaderFilename(
      metadata?.originalname ?? getFilenameFromKey(storageKey)
    );

    return new Response(buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof error.$metadata === "object" &&
      error.$metadata !== null &&
      "httpStatusCode" in error.$metadata &&
      error.$metadata.httpStatusCode === 404
    ) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let storageKey: string;

  try {
    const resolvedParams = await params;
    storageKey = decodeStorageKey(resolvedParams.key);
  } catch {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  if (!storageKey.startsWith(getChatUploadPrefix(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteFileFromS3(storageKey);
  } catch (error) {
    if (!isS3NotFoundError(error)) {
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 }
      );
    }
  }

  await deleteAttachmentAssetByStorageKey({
    storageKey,
    userId: session.user.id,
  });

  return Response.json({ ok: true }, { status: 200 });
}

function isS3NotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null &&
    "httpStatusCode" in error.$metadata &&
    error.$metadata.httpStatusCode === 404
  );
}
