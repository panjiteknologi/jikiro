export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export const SUPPORTED_READABLE_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ...SUPPORTED_READABLE_DOCUMENT_MIME_TYPES,
] as const;

export const ATTACHMENT_ASSET_STATUSES = [
  "uploaded",
  "extracting",
  "indexing",
  "ready",
  "failed",
] as const;

export const MAX_IMAGE_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_EXTRACTION_TEXT_LIMIT = 200_000;
export const DOCUMENT_CONTEXT_TEXT_LIMIT = 12_000;
export const DOCUMENT_CHUNK_SIZE = 1000;
export const DOCUMENT_CHUNK_OVERLAP = 150;
export const DOCUMENT_RETRIEVAL_LIMIT = 8;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
export type SupportedReadableDocumentMimeType =
  (typeof SUPPORTED_READABLE_DOCUMENT_MIME_TYPES)[number];
export type SupportedAttachmentMimeType =
  (typeof SUPPORTED_ATTACHMENT_MIME_TYPES)[number];
export type AttachmentAssetStatus = (typeof ATTACHMENT_ASSET_STATUSES)[number];

export function isSupportedAttachmentMimeType(
  mediaType: string
): mediaType is SupportedAttachmentMimeType {
  return (SUPPORTED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    mediaType
  );
}

export function isImageAttachmentMimeType(
  mediaType: string
): mediaType is SupportedImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mediaType);
}

export function isReadableDocumentMimeType(
  mediaType: string
): mediaType is SupportedReadableDocumentMimeType {
  return (SUPPORTED_READABLE_DOCUMENT_MIME_TYPES as readonly string[]).includes(
    mediaType
  );
}

export function getAttachmentSizeLimit(mediaType: string) {
  return isImageAttachmentMimeType(mediaType)
    ? MAX_IMAGE_ATTACHMENT_SIZE_BYTES
    : MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES;
}

export function getAttachmentAcceptAttribute() {
  return SUPPORTED_ATTACHMENT_MIME_TYPES.join(",");
}

export function getAttachmentStatusLabel(status?: AttachmentAssetStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "uploaded":
    case "extracting":
    case "indexing":
      return "Processing";
    default:
      return null;
  }
}
