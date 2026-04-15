"use client";

import { Separator } from "@/components/ui/separator";
import { ProjectFilesList } from "./project-files-list";
import { ProjectTextResource } from "./project-text-resource";

export function ProjectResourcesPanel({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Resources are shared across every chat in this project. The AI uses them
        as additional context via retrieval.
      </p>
      <ProjectTextResource projectId={projectId} />
      <Separator />
      <ProjectFilesList projectId={projectId} />
    </div>
  );
}
