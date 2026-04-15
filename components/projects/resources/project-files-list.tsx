"use client";

import {
  AlertCircleIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Loader2Icon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  isReadableDocumentMimeType,
  MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
  SUPPORTED_READABLE_DOCUMENT_MIME_TYPES,
} from "@/lib/attachments";
import { fetcher } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type FileAsset = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: "uploaded" | "extracting" | "indexing" | "ready" | "failed";
  error: string | null;
  createdAt: string;
};

function iconForContentType(contentType: string) {
  if (contentType === "application/pdf") {
    return FileTextIcon;
  }
  if (
    contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return FileTextIcon;
  }
  if (
    contentType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return FileSpreadsheetIcon;
  }
  if (contentType === "text/csv") {
    return FileSpreadsheetIcon;
  }
  return FileIcon;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: FileAsset["status"] }) {
  if (status === "ready") {
    return <Badge className="text-xs">Ready</Badge>;
  }
  if (status === "failed") {
    return (
      <Badge className="text-xs" variant="destructive">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="text-xs" variant="secondary">
      <Loader2Icon className="size-3 animate-spin" />
      Processing
    </Badge>
  );
}

export function ProjectFilesList({ projectId }: { projectId: string }) {
  const listUrl = `${API_BASE}/api/projects/${projectId}/resources/files`;
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FileAsset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, mutate } = useSWR<FileAsset[]>(listUrl, fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
    refreshInterval: (latest) =>
      latest?.some((asset) =>
        ["uploaded", "extracting", "indexing"].includes(asset.status)
      )
        ? 2000
        : 0,
  });

  const uploadFile = async (file: File) => {
    if (!isReadableDocumentMimeType(file.type)) {
      toast.error(
        `Unsupported file type: ${file.type || "unknown"}. Allowed: PDF, DOCX, XLSX, CSV, TXT`
      );
      return;
    }
    if (file.size > MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES) {
      toast.error(
        `File is larger than ${(MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`
      );
      return;
    }

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(listUrl, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(body.error ?? "Upload failed");
      }
      await mutate();
      toast.success(`Uploaded ${file.name}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file"
      );
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) {
      return;
    }
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const asset = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await fetch(`${listUrl}/${asset.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      await mutate();
      toast.success("File deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete file"
      );
    }
  };

  const files = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Documents</h3>
        <Button
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <UploadCloudIcon className="size-4" />
          Upload
        </Button>
        <input
          accept={SUPPORTED_READABLE_DOCUMENT_MIME_TYPES.join(",")}
          className="hidden"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files).catch(() => {
              // handled via toast in handleFiles
            });
            if (e.target.value) {
              e.target.value = "";
            }
          }}
          ref={inputRef}
          type="file"
        />
      </div>

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop zone — keyboard path is the Upload button above */}
      <section
        aria-label="Drop files to upload"
        className={`relative rounded-lg border border-dashed transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files).catch(() => {
            // handled via toast in handleFiles
          });
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading documents…
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
            <UploadCloudIcon className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Drop files here or click Upload
            </p>
            <p className="text-xs text-muted-foreground/70">
              PDF, DOCX, XLSX, CSV, TXT
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((asset) => {
              const Icon = iconForContentType(asset.contentType);
              return (
                <li
                  className="flex items-center gap-3 px-3 py-2.5"
                  key={asset.id}
                >
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {asset.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(asset.sizeBytes)}
                    </p>
                    {asset.status === "failed" && asset.error ? (
                      <p className="mt-1 flex items-start gap-1 text-xs text-destructive">
                        <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
                        <span>{asset.error}</span>
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={asset.status} />
                  <Button
                    aria-label="Delete file"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(asset)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{pendingDelete?.filename}&quot;
              and remove it from the project&apos;s context.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
