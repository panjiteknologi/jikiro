import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { DBMessage } from "@/lib/db/schema";

export type { SupportedAttachmentMimeType } from "@/lib/attachments";
export {
  isImageAttachmentMimeType,
  isSupportedAttachmentMimeType,
} from "@/lib/attachments";

type S3Env = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

let s3Client: S3Client | null = null;

function getS3Env(): S3Env {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;

  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing S3 storage environment variables");
  }

  return {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

export function getS3Client() {
  if (s3Client) {
    return s3Client;
  }

  const { endpoint, region, accessKeyId, secretAccessKey } = getS3Env();

  s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  return s3Client;
}

export function getS3Bucket() {
  return getS3Env().bucket;
}

export function sanitizeUploadFilename(filename: string) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return sanitized.length > 0 ? sanitized : "file";
}

export function getChatUploadPrefix(userId: string) {
  return `chat-uploads/${userId}/`;
}

export function buildChatUploadKey({
  userId,
  fileId,
  filename,
}: {
  userId: string;
  fileId: string;
  filename: string;
}) {
  const safeName = sanitizeUploadFilename(filename);

  return {
    key: `${getChatUploadPrefix(userId)}${fileId}-${safeName}`,
    pathname: safeName,
  };
}

export function encodeStorageKey(key: string) {
  return Buffer.from(key, "utf8").toString("base64url");
}

export function decodeStorageKey(encodedKey: string) {
  const decoded = Buffer.from(encodedKey, "base64url").toString("utf8");

  if (!decoded) {
    throw new Error("Invalid storage key");
  }

  return decoded;
}

export function getInternalFileUrl(key: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/${encodeStorageKey(key)}`;
}

export function extractStorageKeyFromFileUrl(url: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const filesPrefix = `${basePath}/api/files/`;

  let pathname = url;

  if (!url.startsWith("/")) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
  }

  if (!pathname.startsWith(filesPrefix)) {
    return null;
  }

  const encodedKey = pathname.slice(filesPrefix.length);

  if (!encodedKey) {
    return null;
  }

  return decodeStorageKey(encodedKey);
}

export async function uploadFileToS3({
  key,
  body,
  contentType,
  filename,
}: {
  key: string;
  body: Buffer;
  contentType: string;
  filename: string;
}) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: {
        originalname: filename,
      },
    })
  );
}

export function getFileFromS3(key: string) {
  return getS3Client().send(
    new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
    })
  );
}

export async function getFileBufferFromS3(key: string) {
  const object = await getFileFromS3(key);

  if (!object.Body) {
    throw new Error("File body not found");
  }

  const body = await object.Body.transformToByteArray();
  const stableBytes = Uint8Array.from(body);

  return {
    buffer: Buffer.from(stableBytes),
    contentType: object.ContentType ?? "application/octet-stream",
    metadata: object.Metadata,
  };
}

export async function getFileDataUrlFromS3(key: string) {
  const { buffer, contentType } = await getFileBufferFromS3(key);

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function deleteFileFromS3(key: string) {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
    })
  );
}

function getStorageKeyFromPartUrl(
  part: unknown,
  userId?: string
): string | null {
  if (typeof part !== "object" || part === null) {
    return null;
  }

  const type = "type" in part ? part.type : undefined;
  const url = "url" in part ? part.url : undefined;

  if (type !== "file" || typeof url !== "string") {
    return null;
  }

  const storageKey = extractStorageKeyFromFileUrl(url);

  if (!storageKey) {
    return null;
  }

  if (userId && !storageKey.startsWith(getChatUploadPrefix(userId))) {
    return null;
  }

  return storageKey;
}

export function extractUniqueStorageKeysFromMessages({
  messages,
  userId,
}: {
  messages: Pick<DBMessage, "parts">[];
  userId?: string;
}) {
  const keys = new Set<string>();

  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      continue;
    }

    for (const part of message.parts) {
      const storageKey = getStorageKeyFromPartUrl(part, userId);

      if (storageKey) {
        keys.add(storageKey);
      }
    }
  }

  return [...keys];
}

export async function deleteFilesFromS3BestEffort({
  keys,
  context,
}: {
  keys: string[];
  context: Record<string, unknown>;
}) {
  if (keys.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    keys.map(async (key) => {
      await deleteFileFromS3(key);
      return key;
    })
  );

  const failedKeys = results.flatMap((result, index) =>
    result.status === "rejected" ? [keys[index]] : []
  );

  if (failedKeys.length > 0) {
    console.error("Failed to delete one or more S3 attachment files", {
      ...context,
      attemptedKeyCount: keys.length,
      failedKeys,
    });
  }
}
