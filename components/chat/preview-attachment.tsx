import type { LucideIcon } from "lucide-react";
import {
  Check,
  CircleX,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileUp,
  FileWarning,
  LoaderCircle,
} from "lucide-react";
import Image from "next/image";
import type { Attachment } from "@/lib/types";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon } from "./icons";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { error, name, status, url, contentType } = attachment;
  const statusMeta = isUploading ? null : getAttachmentStatusMeta(status);
  const filePreview = getFilePreviewMeta(contentType, name);
  const FilePreviewIcon = filePreview.icon;

  return (
    <div
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted"
      data-testid="input-attachment-preview"
      title={error ?? name ?? "attachment"}
    >
      {contentType?.startsWith("image") ? (
        <Image
          alt={name ?? "attachment"}
          className="size-full object-cover"
          height={96}
          src={url}
          unoptimized={url.startsWith("/")}
          width={96}
        />
      ) : (
        <div className="flex size-full min-w-0 flex-col items-center justify-center gap-1 px-2 text-center">
          <div className="">
            <FilePreviewIcon
              className={`size-6 ${filePreview.iconClassName}`}
            />
          </div>
          <div className="text-[8px] font-medium text-foreground">
            {filePreview.label}
          </div>
          <div className="line-clamp-2 w-full max-w-full overflow-hidden break-all text-[8px] leading-tight text-muted-foreground">
            {name ?? "attachment"}
          </div>
        </div>
      )}

      {statusMeta && (
        <div
          className={`absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full border border-background/80 bg-background/95 shadow-sm ${statusMeta.badgeClassName}`}
          title={statusMeta.label}
        >
          <statusMeta.icon className={`size-3 ${statusMeta.iconClassName}`} />
          <span className="sr-only">{statusMeta.label}</span>
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm"
          data-testid="input-attachment-loader"
        >
          <Spinner className="size-5" />
        </div>
      )}

      {onRemove && !isUploading && (
        <button
          className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
          onClick={onRemove}
          type="button"
        >
          <CrossSmallIcon size={10} />
        </button>
      )}
    </div>
  );
};

function getAttachmentStatusMeta(status?: Attachment["status"]): {
  badgeClassName: string;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
} | null {
  switch (status) {
    case "ready":
      return {
        badgeClassName: "text-emerald-700",
        icon: Check,
        iconClassName: "text-emerald-600",
        label: "Ready",
      };
    case "failed":
      return {
        badgeClassName: "text-destructive",
        icon: CircleX,
        iconClassName: "text-destructive",
        label: "Failed",
      };
    case "uploaded":
    case "extracting":
    case "indexing":
      return {
        badgeClassName: "text-amber-700",
        icon: LoaderCircle,
        iconClassName: "animate-spin text-amber-500",
        label: "Processing",
      };
    default:
      return null;
  }
}

function getFilePreviewMeta(contentType?: string, name?: string) {
  const extension = name?.split(".").at(-1)?.toUpperCase();

  if (contentType === "application/pdf") {
    return {
      icon: FileText,
      iconClassName: "text-rose-600",
      label: "PDF",
    };
  }

  if (
    contentType === "text/csv" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return {
      icon: FileSpreadsheet,
      iconClassName: "text-emerald-600",
      label: extension === "CSV" ? "CSV" : "XLSX",
    };
  }

  if (
    contentType === "text/plain" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return {
      icon: FileType2,
      iconClassName: "text-sky-600",
      label: extension === "TXT" ? "TXT" : "DOCX",
    };
  }

  if (contentType) {
    return {
      icon: FileUp,
      iconClassName: "text-muted-foreground",
      label: extension ?? "FILE",
    };
  }

  return {
    icon: FileWarning,
    iconClassName: "text-amber-600",
    label: "FILE",
  };
}
