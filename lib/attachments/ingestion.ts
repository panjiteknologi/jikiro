import mammoth from "mammoth";
import Papa from "papaparse";
import { PDFParse } from "pdf-parse";
import XLSX from "xlsx";
import {
  DOCUMENT_CHUNK_OVERLAP,
  DOCUMENT_CHUNK_SIZE,
  DOCUMENT_CONTEXT_TEXT_LIMIT,
  DOCUMENT_EXTRACTION_TEXT_LIMIT,
  isReadableDocumentMimeType,
  type SupportedReadableDocumentMimeType,
} from "@/lib/attachments";

export type ExtractedDocumentText = {
  text: string;
  truncated: boolean;
};

export type RetrievedDocumentChunk = {
  attachmentId: string;
  filename: string;
  text: string;
};

export async function extractReadableDocumentText({
  buffer,
  contentType,
}: {
  buffer: Buffer;
  contentType: SupportedReadableDocumentMimeType;
}): Promise<ExtractedDocumentText> {
  let extractedText: string;

  switch (contentType) {
    case "text/plain":
      extractedText = buffer.toString("utf8");
      break;
    case "text/csv":
      extractedText = extractCsvText(buffer);
      break;
    case "application/pdf":
      extractedText = await extractPdfText(buffer);
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      extractedText = await extractDocxText(buffer);
      break;
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      extractedText = extractXlsxText(buffer);
      break;
    default:
      throw new Error(`Unsupported readable document type: ${contentType}`);
  }

  const normalizedText = normalizeExtractedText(extractedText);

  if (!normalizedText) {
    throw new Error("No readable text could be extracted from this file");
  }

  const truncated = normalizedText.length > DOCUMENT_EXTRACTION_TEXT_LIMIT;

  return {
    text: truncated
      ? normalizedText.slice(0, DOCUMENT_EXTRACTION_TEXT_LIMIT)
      : normalizedText,
    truncated,
  };
}

export function chunkExtractedDocumentText(text: string) {
  const chunks: string[] = [];
  const normalized = normalizeExtractedText(text);

  if (!normalized) {
    return chunks;
  }

  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + DOCUMENT_CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - DOCUMENT_CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

export function buildRetrievedDocumentContext(
  chunks: RetrievedDocumentChunk[],
  limit = DOCUMENT_CONTEXT_TEXT_LIMIT
) {
  let context = "";

  for (const chunk of chunks) {
    const section = `File: ${chunk.filename}\n${chunk.text.trim()}`;

    if (!section.trim()) {
      continue;
    }

    if (!context) {
      context = section.slice(0, limit);
      if (context.length >= limit) {
        break;
      }
      continue;
    }

    const candidate = `${context}\n\n---\n\n${section}`;
    if (candidate.length > limit) {
      break;
    }

    context = candidate;
  }

  return context.trim();
}

export function getAttachmentRetrievalQuery(text: string) {
  const normalized = normalizeExtractedText(text);
  return normalized || "Summarize the attached document(s).";
}

export function normalizeExtractedText(text: string) {
  return text
    .replaceAll("\u0000", " ")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasReadableDocumentContentType(mediaType: string) {
  return isReadableDocumentMimeType(mediaType);
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractCsvText(buffer: Buffer) {
  const sourceText = buffer.toString("utf8");
  const parsed = Papa.parse<string[]>(sourceText, {
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "Failed to parse CSV file");
  }

  return parsed.data
    .map((row) => row.map((cell) => String(cell ?? "").trim()).join(" | "))
    .join("\n");
}

function extractXlsxText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const sheetText = XLSX.utils
      .sheet_to_csv(sheet, { blankrows: false })
      .trim();

    return sheetText
      ? `Sheet: ${sheetName}\n${sheetText}`
      : `Sheet: ${sheetName}`;
  }).join("\n\n");
}
