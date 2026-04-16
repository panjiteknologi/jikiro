"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_EXTRACTION_TEXT_LIMIT } from "@/lib/attachments";
import { fetcher } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type ProjectTextResponse = {
  text: string | null;
  status: "uploaded" | "extracting" | "indexing" | "ready" | "failed" | null;
  error?: string | null;
  updatedAt: string | null;
  sizeBytes: number;
};

function StatusBadge({
  status,
  hasContent,
}: {
  status: ProjectTextResponse["status"];
  hasContent: boolean;
}) {
  if (!hasContent) {
    return (
      <Badge className="text-xs" variant="outline">
        Empty
      </Badge>
    );
  }

  if (status === "ready") {
    return <Badge className="text-xs">Indexed</Badge>;
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
      Indexing
    </Badge>
  );
}

export function ProjectTextResource({ projectId }: { projectId: string }) {
  const { data, isLoading, mutate } = useSWR<ProjectTextResponse>(
    `${API_BASE}/api/projects/${projectId}/resources/text`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasLocalEdit, setHasLocalEdit] = useState(false);

  useEffect(() => {
    if (!hasLocalEdit && data) {
      setValue(data.text ?? "");
    }
  }, [data, hasLocalEdit]);

  const remoteText = data?.text ?? "";
  const isDirty = value !== remoteText;
  const charCount = value.length;
  const overLimit = charCount > DOCUMENT_EXTRACTION_TEXT_LIMIT;

  const handleSave = async () => {
    if (overLimit) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/resources/text`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(body.error ?? "Save failed");
      }
      setHasLocalEdit(false);
      await mutate();
      toast.success("Project text saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save project text"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Text context</h3>
          {!isLoading && (
            <StatusBadge
              hasContent={remoteText.length > 0}
              status={data?.status ?? null}
            />
          )}
        </div>
        <span
          className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
        >
          {charCount.toLocaleString()} /{" "}
          {DOCUMENT_EXTRACTION_TEXT_LIMIT.toLocaleString()}
        </span>
      </div>
      <Textarea
        className="min-h-40 resize-y font-mono text-[13px]"
        disabled={isLoading}
        onChange={(e) => {
          setValue(e.target.value);
          setHasLocalEdit(true);
        }}
        placeholder="Add notes, guidelines, or any background info that the AI should always know about this project…"
        value={value}
      />
      {data?.status === "failed" && data.error ? (
        <p className="text-xs text-destructive">{data.error}</p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {isDirty && !isSaving ? (
          <Button
            onClick={() => {
              setValue(remoteText);
              setHasLocalEdit(false);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Reset
          </Button>
        ) : null}
        <Button
          disabled={!isDirty || isSaving || overLimit}
          onClick={handleSave}
          size="sm"
          type="button"
        >
          {isSaving ? (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              Saving
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
