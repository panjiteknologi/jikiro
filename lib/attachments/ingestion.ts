import mammoth from "mammoth";
import Papa from "papaparse";
import { read, utils } from "xlsx";
import {
  DOCUMENT_CHUNK_OVERLAP,
  DOCUMENT_CHUNK_SIZE,
  DOCUMENT_CONTEXT_TEXT_LIMIT,
  DOCUMENT_EXTRACTION_TEXT_LIMIT,
  isReadableDocumentMimeType,
  type SupportedReadableDocumentMimeType,
} from "@/lib/attachments";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfWorkerModule = typeof import("pdfjs-dist/legacy/build/pdf.worker.mjs");
type PdfLoadingTask = ReturnType<PdfJsModule["getDocument"]>;
type PdfPage = {
  cleanup(): void;
  getTextContent(options: {
    disableNormalization: boolean;
    includeMarkedContent: boolean;
  }): Promise<{ items: unknown[] }>;
};

export type ExtractedDocumentText = {
  text: string;
  truncated: boolean;
};

export type RetrievedDocumentChunk = {
  attachmentId: string;
  filename: string;
  text: string;
  origin?: "chat" | "project";
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
    const label = chunk.origin === "project" ? "Project resource" : "File";
    const section = `${label}: ${chunk.filename}\n${chunk.text.trim()}`;

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
    .normalize("NFKC")
    .replaceAll("\u0000", " ")
    .replaceAll("\u00a0", " ")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hasReadableDocumentContentType(mediaType: string) {
  return isReadableDocumentMimeType(mediaType);
}

async function extractPdfText(buffer: Buffer) {
  const loadingTask = await createPdfLoadingTask(buffer);

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);

      try {
        const pageText = await extractPdfPageText(page);

        if (pageText) {
          pages.push(pageText);
        }
      } finally {
        page.cleanup();
      }
    }

    return pages.join("\n\n");
  } catch (error) {
    throw new Error(getPdfExtractionErrorMessage(error));
  } finally {
    await loadingTask.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(getDocxExtractionErrorMessage(error));
  }
}

function extractCsvText(buffer: Buffer) {
  const sourceText = decodeTextBuffer(buffer);
  const parsed = Papa.parse<string[]>(sourceText, {
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error(
      `Failed to parse CSV file: ${parsed.errors[0]?.message ?? "Unknown CSV parser error"}`
    );
  }

  return renderTabularRows(parsed.data);
}

function extractXlsxText(buffer: Buffer) {
  try {
    const workbook = read(buffer, {
      cellDates: true,
      cellText: true,
      type: "buffer",
    });

    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = utils.sheet_to_json<string[]>(sheet, {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      });
      const sheetText = renderTabularRows(rows);

      return sheetText
        ? `Sheet: ${sheetName}\n${sheetText}`
        : `Sheet: ${sheetName}`;
    }).join("\n\n");
  } catch (error) {
    throw new Error(getXlsxExtractionErrorMessage(error));
  }
}

async function createPdfLoadingTask(buffer: Buffer): Promise<PdfLoadingTask> {
  const pdfJs = await loadPdfJs();
  const { getDocument, VerbosityLevel } = pdfJs;

  await ensurePdfJsWorker();

  return getDocument({
    data: Uint8Array.from(buffer),
    disableFontFace: true,
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    stopAtErrors: false,
    useSystemFonts: false,
    useWorkerFetch: false,
    verbosity: VerbosityLevel.ERRORS,
  });
}

async function extractPdfPageText(page: PdfPage) {
  const textContent = await page.getTextContent({
    disableNormalization: false,
    includeMarkedContent: false,
  });

  const lines: Array<{ height: number; text: string; y: number }> = [];
  let currentLine: PdfTextFragment[] = [];
  let pendingGapBefore = 0;

  const flushLine = () => {
    const builtLine = buildPdfLine(currentLine);

    if (!builtLine) {
      currentLine = [];
      return;
    }

    const lineHeight = Math.max(
      ...currentLine.map((fragment) => fragment.height || 0),
      1
    );

    lines.push({
      height: lineHeight,
      text: builtLine,
      y: currentLine[0]?.y ?? 0,
    });
    currentLine = [];
  };

  for (const item of textContent.items) {
    if (!isPdfTextItem(item)) {
      continue;
    }

    const text = item.str.replace(/[^\S\n]+/g, " ").trim();
    const x = Number(item.transform[4] ?? 0);
    const y = Number(item.transform[5] ?? 0);
    const height = Math.abs(Number(item.height ?? 0)) || 1;

    if (!text && !item.hasEOL) {
      continue;
    }

    const fragment: PdfTextFragment = {
      hasEOL: Boolean(item.hasEOL),
      height,
      text,
      width: Math.abs(Number(item.width ?? 0)),
      x,
      y,
    };

    const previousFragment = currentLine.at(-1);

    if (previousFragment) {
      const lineHeight = Math.max(previousFragment.height, fragment.height, 1);
      const yGap = Math.abs(previousFragment.y - fragment.y);

      if (yGap > lineHeight * 0.75) {
        pendingGapBefore = yGap;
        flushLine();
      }
    }

    if (
      pendingGapBefore > 0 &&
      lines.length > 0 &&
      pendingGapBefore >
        Math.max(lines.at(-1)?.height ?? 1, fragment.height) * 1.6
    ) {
      lines.push({
        height: 0,
        text: "",
        y,
      });
    }

    pendingGapBefore = 0;
    currentLine.push(fragment);

    if (fragment.hasEOL) {
      flushLine();
    }
  }

  flushLine();

  return lines
    .map((line) => line.text)
    .filter((line, index, allLines) => {
      if (line) {
        return true;
      }

      return index > 0 && index < allLines.length - 1;
    })
    .join("\n");
}

function buildPdfLine(fragments: PdfTextFragment[]) {
  const sortedFragments = [...fragments].sort(
    (left, right) => left.x - right.x
  );
  let line = "";

  for (const [index, fragment] of sortedFragments.entries()) {
    if (!fragment.text) {
      continue;
    }

    const previous = sortedFragments[index - 1];

    if (previous && line) {
      const gap = fragment.x - (previous.x + previous.width);
      const gapThreshold = Math.max(previous.height, fragment.height, 1) * 0.15;

      if (gap > gapThreshold && !line.endsWith(" ")) {
        line += " ";
      }
    }

    line += fragment.text;
  }

  return line.replace(/[^\S\n]+/g, " ").trim();
}

function decodeTextBuffer(buffer: Buffer) {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function renderTabularRows(rows: readonly (readonly unknown[])[]) {
  return rows
    .map((row, index) => {
      const cells = trimTrailingEmptyCells(
        row.map((cell) =>
          String(cell ?? "")
            .replace(/\s+/g, " ")
            .trim()
        )
      );

      if (cells.length === 0) {
        return null;
      }

      return `Row ${index + 1}: ${cells.join(" | ")}`;
    })
    .filter((row): row is string => row !== null)
    .join("\n");
}

function trimTrailingEmptyCells(cells: string[]) {
  const trimmedCells = [...cells];

  while (trimmedCells.at(-1) === "") {
    trimmedCells.pop();
  }

  return trimmedCells;
}

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let pdfJsWorkerModulePromise: Promise<PdfWorkerModule> | null = null;

async function loadPdfJs() {
  pdfJsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfJsModulePromise;
}

async function loadPdfJsWorker() {
  pdfJsWorkerModulePromise ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return pdfJsWorkerModulePromise;
}

async function ensurePdfJsWorker() {
  const { WorkerMessageHandler } = await loadPdfJsWorker();
  const pdfJsGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: {
      WorkerMessageHandler?: typeof WorkerMessageHandler;
    };
  };

  if (pdfJsGlobal.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  pdfJsGlobal.pdfjsWorker = { WorkerMessageHandler };
}

function isPdfTextItem(item: unknown): item is {
  hasEOL?: boolean;
  height?: number;
  str: string;
  transform: number[];
  width?: number;
} {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof item.str === "string" &&
    "transform" in item &&
    Array.isArray(item.transform)
  );
}

function getPdfExtractionErrorMessage(error: unknown) {
  const details = error instanceof Error ? error.message : "Unknown PDF error";
  return `Failed to extract text from PDF. The file may be scanned, encrypted, or unsupported. ${details}`.trim();
}

function getDocxExtractionErrorMessage(error: unknown) {
  const details =
    error instanceof Error ? error.message : "Unknown DOCX parser error";
  return `Failed to extract text from DOCX file: ${details}`;
}

function getXlsxExtractionErrorMessage(error: unknown) {
  const details =
    error instanceof Error ? error.message : "Unknown spreadsheet parser error";
  return `Failed to extract text from XLSX file: ${details}`;
}

type PdfTextFragment = {
  hasEOL: boolean;
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
};
