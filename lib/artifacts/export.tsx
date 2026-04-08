"use client";

import type { IParagraphOptions, Paragraph, ParagraphChild } from "docx";
import { parse, unparse } from "papaparse";
import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";
import { buildDocumentFromContent } from "@/lib/editor/functions";

const CSV_MIME_TYPE = "text/csv;charset=utf-8";
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CODE_EXPORT_MIME_TYPES = {
  py: "text/x-python;charset=utf-8",
  js: "text/javascript;charset=utf-8",
  ts: "application/typescript;charset=utf-8",
} as const;

type ExportPayload = {
  title: string;
  content: string;
};

type CodeExportFormat = keyof typeof CODE_EXPORT_MIME_TYPES;

type DocxModule = typeof import("docx");
type PdfConstructor = typeof import("jspdf").jsPDF;

type BlockRenderContext = {
  blockquoteDepth: number;
  list?: {
    kind: "bullet" | "ordered";
    level: number;
    attachNumbering: boolean;
  };
};

type PdfFontName = "courier" | "helvetica" | "times";
type PdfFontStyle = "bold" | "bolditalic" | "italic" | "normal";

type PdfTextBlock = {
  kind: "text";
  text: string;
  indent: number;
  before: number;
  after: number;
  fontName: PdfFontName;
  fontSize: number;
  fontStyle: PdfFontStyle;
  textColor: [number, number, number];
};

type PdfRuleBlock = {
  kind: "rule";
  indent: number;
  before: number;
  after: number;
};

type PdfBlock = PdfRuleBlock | PdfTextBlock;

type PdfRenderContext = {
  blockquoteDepth: number;
  list?: {
    level: number;
    marker: string | null;
  };
};

const PDF_BLOCKQUOTE_INDENT = 18;
const PDF_BODY_COLOR: [number, number, number] = [15, 23, 42];
const PDF_CODE_COLOR: [number, number, number] = [51, 65, 85];
const PDF_LINE_HEIGHT_MULTIPLIER = 1.45;
const PDF_LIST_INDENT = 18;
const PDF_MARGIN = 40;
const PDF_RULE_COLOR: [number, number, number] = [203, 213, 225];

export function sanitizeArtifactFilename(title: string) {
  const sanitized = title
    .trim()
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);

      return !/[<>:"/\\|?*]/.test(character) && code >= 32;
    })
    .join("")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "untitled";
}

function createDownloadFilename(title: string, extension: string) {
  return `${sanitizeArtifactFilename(title)}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function trimTrailingEmptyCells(row: string[]) {
  const trimmedRow = [...row];

  while (trimmedRow.length > 0 && trimmedRow.at(-1)?.trim() === "") {
    trimmedRow.pop();
  }

  return trimmedRow;
}

function normalizeSheetRows(content: string) {
  const parsed = parse<string[]>(content, { skipEmptyLines: true });

  return parsed.data
    .map((row) => trimTrailingEmptyCells(row))
    .filter((row) => row.some((cell) => cell.trim() !== ""));
}

function buildCodeBlockChildren(docx: DocxModule, text: string) {
  const lines = text.split("\n");

  return lines.flatMap((line, index) => {
    const lineRun = new docx.TextRun({
      text: line,
      font: "Courier New",
      size: 20,
    });

    if (index === lines.length - 1) {
      return [lineRun];
    }

    return [lineRun, new docx.TextRun({ break: 1 })];
  });
}

function createTextRun(
  docx: DocxModule,
  text: string,
  marks: readonly Mark[] = []
): ParagraphChild[] {
  if (!text) {
    return [];
  }

  const isBold = marks.some((mark) => mark.type.name === "strong");
  const isItalic = marks.some((mark) => mark.type.name === "em");
  const isCode = marks.some((mark) => mark.type.name === "code");
  const linkMark = marks.find((mark) => mark.type.name === "link");

  const textRun = new docx.TextRun({
    text,
    bold: isBold,
    italics: isItalic,
    font: isCode ? "Courier New" : undefined,
    size: isCode ? 20 : undefined,
    color: linkMark ? "0563C1" : undefined,
    underline: linkMark ? {} : undefined,
  });

  if (linkMark?.attrs?.href) {
    return [
      new docx.ExternalHyperlink({
        children: [textRun],
        link: linkMark.attrs.href,
      }),
    ];
  }

  return [textRun];
}

function convertInlineNode(
  node: ProseMirrorNode,
  docx: DocxModule
): ParagraphChild[] {
  switch (node.type.name) {
    case "text":
      return createTextRun(docx, node.text ?? "", node.marks);
    case "hard_break":
      return [new docx.TextRun({ break: 1 })];
    case "image":
      return createTextRun(
        docx,
        node.attrs.alt ? `[Image: ${node.attrs.alt}]` : "[Image]",
        []
      );
    default:
      return node.textContent ? createTextRun(docx, node.textContent) : [];
  }
}

function convertInlineChildren(
  node: ProseMirrorNode,
  docx: DocxModule
): ParagraphChild[] {
  const children: ParagraphChild[] = [];

  for (const child of node.content.content) {
    children.push(...convertInlineNode(child, docx));
  }

  if (children.length === 0) {
    children.push(new docx.TextRun(""));
  }

  return children;
}

function getParagraphOptions(
  docx: DocxModule,
  context: BlockRenderContext
): IParagraphOptions {
  const quoteIndent = context.blockquoteDepth * 360;
  const listContinuationIndent =
    context.list && !context.list.attachNumbering
      ? 720 * (context.list.level + 1)
      : 0;
  const indentLeft = quoteIndent + listContinuationIndent;

  return {
    border:
      context.blockquoteDepth > 0
        ? {
            left: {
              color: "D1D5DB",
              size: 12,
              space: 4,
              style: docx.BorderStyle.SINGLE,
            },
          }
        : undefined,
    indent: indentLeft > 0 ? { left: indentLeft } : undefined,
    numbering:
      context.list?.attachNumbering === true
        ? {
            reference:
              context.list.kind === "bullet"
                ? "artifact-bullets"
                : "artifact-ordered",
            level: Math.min(context.list.level, 7),
          }
        : undefined,
    spacing: {
      after: 160,
    },
  };
}

function convertList(
  node: ProseMirrorNode,
  docx: DocxModule,
  context: BlockRenderContext,
  kind: "bullet" | "ordered"
) {
  const paragraphs: Paragraph[] = [];
  const level = context.list ? context.list.level + 1 : 0;

  for (const listItem of node.content.content) {
    if (listItem.type.name !== "list_item") {
      continue;
    }

    let hasPrimaryBlock = false;

    for (const child of listItem.content.content) {
      if (
        child.type.name === "bullet_list" ||
        child.type.name === "ordered_list"
      ) {
        paragraphs.push(
          ...convertBlockNode(
            child,
            docx,
            hasPrimaryBlock
              ? context
              : {
                  ...context,
                  list: {
                    kind,
                    level,
                    attachNumbering: true,
                  },
                }
          )
        );
        continue;
      }

      const nextParagraphs = convertBlockNode(child, docx, {
        ...context,
        list: {
          kind,
          level,
          attachNumbering: !hasPrimaryBlock,
        },
      });

      if (nextParagraphs.length > 0) {
        hasPrimaryBlock = true;
      }

      paragraphs.push(...nextParagraphs);
    }

    if (!hasPrimaryBlock) {
      paragraphs.push(
        new docx.Paragraph({
          ...getParagraphOptions(docx, {
            ...context,
            list: {
              kind,
              level,
              attachNumbering: true,
            },
          }),
          children: [new docx.TextRun("")],
        })
      );
    }
  }

  return paragraphs;
}

function convertBlockNode(
  node: ProseMirrorNode,
  docx: DocxModule,
  context: BlockRenderContext
): Paragraph[] {
  const paragraphOptions = getParagraphOptions(docx, context);

  switch (node.type.name) {
    case "paragraph":
      return [
        new docx.Paragraph({
          ...paragraphOptions,
          children: convertInlineChildren(node, docx),
        }),
      ];
    case "heading":
      return [
        new docx.Paragraph({
          ...paragraphOptions,
          children: convertInlineChildren(node, docx),
          heading: [
            docx.HeadingLevel.HEADING_1,
            docx.HeadingLevel.HEADING_2,
            docx.HeadingLevel.HEADING_3,
            docx.HeadingLevel.HEADING_4,
            docx.HeadingLevel.HEADING_5,
            docx.HeadingLevel.HEADING_6,
          ][Math.max(0, Math.min((node.attrs.level ?? 1) - 1, 5))],
          spacing: {
            before: 240,
            after: 120,
          },
        }),
      ];
    case "blockquote": {
      const blockquoteParagraphs: Paragraph[] = [];

      for (const child of node.content.content) {
        blockquoteParagraphs.push(
          ...convertBlockNode(child, docx, {
            ...context,
            blockquoteDepth: context.blockquoteDepth + 1,
          })
        );
      }

      return blockquoteParagraphs;
    }
    case "code_block":
      return [
        new docx.Paragraph({
          ...paragraphOptions,
          border: {
            left: {
              color: "CBD5E1",
              size: 12,
              space: 4,
              style: docx.BorderStyle.SINGLE,
            },
          },
          children: buildCodeBlockChildren(docx, node.textContent),
          shading: {
            fill: "F8FAFC",
          },
          spacing: {
            before: 120,
            after: 200,
          },
        }),
      ];
    case "bullet_list":
      return convertList(node, docx, context, "bullet");
    case "ordered_list":
      return convertList(node, docx, context, "ordered");
    case "horizontal_rule":
      return [
        new docx.Paragraph({
          border: {
            bottom: {
              color: "D1D5DB",
              size: 6,
              space: 2,
              style: docx.BorderStyle.SINGLE,
            },
          },
          spacing: {
            before: 200,
            after: 200,
          },
        }),
      ];
    default:
      return node.isTextblock
        ? [
            new docx.Paragraph({
              ...paragraphOptions,
              children: convertInlineChildren(node, docx),
            }),
          ]
        : [];
  }
}

function createNumberingConfig(docx: DocxModule) {
  return [
    {
      reference: "artifact-bullets",
      levels: Array.from({ length: 8 }, (_, level) => ({
        level,
        format: "bullet" as const,
        text: ["•", "○", "■"][level % 3],
        alignment: docx.AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: {
              left: 720 * (level + 1),
              hanging: 360,
            },
          },
        },
      })),
    },
    {
      reference: "artifact-ordered",
      levels: Array.from({ length: 8 }, (_, level) => ({
        level,
        format: "decimal" as const,
        text: `%${level + 1}.`,
        alignment: docx.AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: {
              left: 720 * (level + 1),
              hanging: 360,
            },
          },
        },
      })),
    },
  ];
}

function getPdfIndent(context: PdfRenderContext) {
  return (
    context.blockquoteDepth * PDF_BLOCKQUOTE_INDENT +
    (context.list ? (context.list.level + 1) * PDF_LIST_INDENT : 0)
  );
}

function getPdfListMarker(
  kind: "bullet" | "ordered",
  level: number,
  index: number
) {
  if (kind === "ordered") {
    return `${index + 1}.`;
  }

  return ["•", "○", "■"][level % 3];
}

function getInlineText(node: ProseMirrorNode) {
  const parts: string[] = [];

  for (const child of node.content.content) {
    switch (child.type.name) {
      case "text":
        parts.push(child.text ?? "");
        break;
      case "hard_break":
        parts.push("\n");
        break;
      case "image":
        parts.push(child.attrs.alt ? `[Image: ${child.attrs.alt}]` : "[Image]");
        break;
      default:
        parts.push(child.textContent);
        break;
    }
  }

  return parts.join("");
}

function createPdfTextBlock(
  text: string,
  context: PdfRenderContext,
  style: Pick<
    PdfTextBlock,
    "fontName" | "fontSize" | "fontStyle" | "textColor"
  >,
  spacing: Pick<PdfTextBlock, "after" | "before">
): PdfTextBlock {
  const markerPrefix = context.list?.marker ? `${context.list.marker} ` : "";

  return {
    kind: "text",
    text: `${markerPrefix}${text}`.trimEnd(),
    indent: getPdfIndent(context),
    ...spacing,
    ...style,
  };
}

function convertListToPdfBlocks(
  node: ProseMirrorNode,
  context: PdfRenderContext,
  kind: "bullet" | "ordered"
) {
  const blocks: PdfBlock[] = [];
  const level = context.list ? context.list.level + 1 : 0;

  node.content.content.forEach((listItem, index) => {
    if (listItem.type.name !== "list_item") {
      return;
    }

    let hasPrimaryBlock = false;
    const marker = getPdfListMarker(kind, level, index);

    for (const child of listItem.content.content) {
      if (
        child.type.name === "bullet_list" ||
        child.type.name === "ordered_list"
      ) {
        if (!hasPrimaryBlock) {
          blocks.push(
            createPdfTextBlock(
              "",
              {
                ...context,
                list: {
                  level,
                  marker,
                },
              },
              {
                fontName: "helvetica",
                fontSize: 12,
                fontStyle: "normal",
                textColor: PDF_BODY_COLOR,
              },
              {
                before: 0,
                after: 6,
              }
            )
          );
          hasPrimaryBlock = true;
        }

        blocks.push(
          ...convertBlockNodeToPdfBlocks(child, {
            ...context,
            list: {
              level,
              marker: null,
            },
          })
        );
        continue;
      }

      const nextBlocks = convertBlockNodeToPdfBlocks(child, {
        ...context,
        list: {
          level,
          marker: hasPrimaryBlock ? null : marker,
        },
      });

      if (nextBlocks.length > 0) {
        hasPrimaryBlock = true;
      }

      blocks.push(...nextBlocks);
    }

    if (!hasPrimaryBlock) {
      blocks.push(
        createPdfTextBlock(
          "",
          {
            ...context,
            list: {
              level,
              marker,
            },
          },
          {
            fontName: "helvetica",
            fontSize: 12,
            fontStyle: "normal",
            textColor: PDF_BODY_COLOR,
          },
          {
            before: 0,
            after: 12,
          }
        )
      );
    }
  });

  return blocks;
}

function convertBlockNodeToPdfBlocks(
  node: ProseMirrorNode,
  context: PdfRenderContext
): PdfBlock[] {
  switch (node.type.name) {
    case "paragraph":
      return [
        createPdfTextBlock(
          getInlineText(node),
          context,
          {
            fontName: "helvetica",
            fontSize: 12,
            fontStyle: "normal",
            textColor: PDF_BODY_COLOR,
          },
          {
            before: 0,
            after: 12,
          }
        ),
      ];
    case "heading": {
      const level = Math.max(1, Math.min(node.attrs.level ?? 1, 6));
      const fontSizeByLevel = [22, 18, 16, 14, 13, 12];

      return [
        createPdfTextBlock(
          getInlineText(node),
          context,
          {
            fontName: "helvetica",
            fontSize: fontSizeByLevel[level - 1] ?? 12,
            fontStyle: "bold",
            textColor: PDF_BODY_COLOR,
          },
          {
            before: level === 1 ? 10 : 6,
            after: 10,
          }
        ),
      ];
    }
    case "blockquote":
      return node.content.content.flatMap((child) =>
        convertBlockNodeToPdfBlocks(child, {
          ...context,
          blockquoteDepth: context.blockquoteDepth + 1,
        })
      );
    case "code_block":
      return [
        createPdfTextBlock(
          node.textContent,
          context,
          {
            fontName: "courier",
            fontSize: 10,
            fontStyle: "normal",
            textColor: PDF_CODE_COLOR,
          },
          {
            before: 4,
            after: 12,
          }
        ),
      ];
    case "bullet_list":
      return convertListToPdfBlocks(node, context, "bullet");
    case "ordered_list":
      return convertListToPdfBlocks(node, context, "ordered");
    case "horizontal_rule":
      return [
        {
          kind: "rule",
          indent: getPdfIndent(context),
          before: 8,
          after: 12,
        },
      ];
    default:
      return node.isTextblock
        ? [
            createPdfTextBlock(
              getInlineText(node),
              context,
              {
                fontName: "helvetica",
                fontSize: 12,
                fontStyle: "normal",
                textColor: PDF_BODY_COLOR,
              },
              {
                before: 0,
                after: 12,
              }
            ),
          ]
        : [];
  }
}

function getPdfLines(
  pdf: InstanceType<PdfConstructor>,
  text: string,
  maxWidth: number
) {
  const lines: string[] = [];

  for (const segment of text.split("\n")) {
    const wrapped = pdf.splitTextToSize(segment || " ", maxWidth);

    if (Array.isArray(wrapped) && wrapped.length > 0) {
      lines.push(...wrapped.map(String));
    } else {
      lines.push("");
    }
  }

  return lines;
}

function renderPdfBlocks(
  pdf: InstanceType<PdfConstructor>,
  blocks: PdfBlock[]
) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let cursorY = PDF_MARGIN;

  for (const block of blocks) {
    cursorY += block.before;

    if (block.kind === "rule") {
      if (cursorY + 8 > pageHeight - PDF_MARGIN) {
        pdf.addPage();
        cursorY = PDF_MARGIN;
      }

      const x = PDF_MARGIN + block.indent;

      pdf.setDrawColor(...PDF_RULE_COLOR);
      pdf.setLineWidth(1);
      pdf.line(x, cursorY, pageWidth - PDF_MARGIN, cursorY);

      cursorY += block.after;
      continue;
    }

    const x = PDF_MARGIN + block.indent;
    const maxWidth = pageWidth - PDF_MARGIN - x;

    pdf.setFont(block.fontName, block.fontStyle);
    pdf.setFontSize(block.fontSize);
    pdf.setTextColor(...block.textColor);

    const lines = getPdfLines(pdf, block.text, maxWidth);
    const lineHeight = block.fontSize * PDF_LINE_HEIGHT_MULTIPLIER;

    for (const line of lines) {
      if (cursorY + lineHeight > pageHeight - PDF_MARGIN) {
        pdf.addPage();
        cursorY = PDF_MARGIN;
      }

      if (line.trim().length > 0) {
        pdf.text(line, x, cursorY + block.fontSize);
      }

      cursorY += lineHeight;
    }

    cursorY += block.after;
  }
}

function createPdfDocument(
  JsPdf: PdfConstructor,
  { content, title }: ExportPayload
) {
  const documentNode = buildDocumentFromContent(content);
  const pdf = new JsPdf({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const blocks: PdfBlock[] = [
    createPdfTextBlock(
      title || "Untitled",
      {
        blockquoteDepth: 0,
      },
      {
        fontName: "helvetica",
        fontSize: 24,
        fontStyle: "bold",
        textColor: PDF_BODY_COLOR,
      },
      {
        before: 0,
        after: 18,
      }
    ),
    {
      kind: "rule",
      indent: 0,
      before: 0,
      after: 18,
    },
  ];

  for (const child of documentNode.content.content) {
    blocks.push(
      ...convertBlockNodeToPdfBlocks(child, {
        blockquoteDepth: 0,
      })
    );
  }

  renderPdfBlocks(pdf, blocks);

  return pdf;
}

export async function exportTextAsDocx({ title, content }: ExportPayload) {
  const docx = await import("docx");
  const documentNode = buildDocumentFromContent(content);
  const children: Paragraph[] = [
    new docx.Paragraph({
      text: title || "Untitled",
      heading: docx.HeadingLevel.TITLE,
      spacing: {
        after: 240,
      },
    }),
  ];

  for (const child of documentNode.content.content) {
    children.push(
      ...convertBlockNode(child, docx, {
        blockquoteDepth: 0,
      })
    );
  }

  const doc = new docx.Document({
    numbering: {
      config: createNumberingConfig(docx),
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await docx.Packer.toBlob(doc);

  downloadBlob(blob, createDownloadFilename(title, "docx"));
}

export async function exportTextAsPdf({ title, content }: ExportPayload) {
  const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
  const pdf = createPdfDocument(jsPDF, {
    title,
    content,
  });

  downloadBlob(pdf.output("blob"), createDownloadFilename(title, "pdf"));
}

export function exportSheetAsCsv({ title, content }: ExportPayload) {
  const cleanedCsv = unparse(normalizeSheetRows(content));

  downloadBlob(
    new Blob([cleanedCsv], {
      type: CSV_MIME_TYPE,
    }),
    createDownloadFilename(title, "csv")
  );
}

export async function exportSheetAsXlsx({ title, content }: ExportPayload) {
  const xlsx = await import("xlsx");
  const rows = normalizeSheetRows(content);
  const worksheet = xlsx.utils.aoa_to_sheet(rows.length > 0 ? rows : [[]]);
  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const output = xlsx.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  downloadBlob(
    new Blob([output], {
      type: XLSX_MIME_TYPE,
    }),
    createDownloadFilename(title, "xlsx")
  );
}

export function exportCodeAsFile({
  title,
  content,
  extension,
}: ExportPayload & {
  extension: CodeExportFormat;
}) {
  downloadBlob(
    new Blob([content], {
      type: CODE_EXPORT_MIME_TYPES[extension],
    }),
    createDownloadFilename(title, extension)
  );
}
