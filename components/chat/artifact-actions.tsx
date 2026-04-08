import { memo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { artifactDefinitions, type UIArtifact } from "./artifact";
import type { ArtifactActionContext } from "./create-artifact";

type ArtifactActionsProps = {
  artifact: UIArtifact;
  getDocumentContentById: (index: number) => string;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "edit" | "diff";
  metadata: ArtifactActionContext["metadata"];
  setMetadata: ArtifactActionContext["setMetadata"];
};

function getActionTestId(value: string) {
  return `artifact-action-${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function PureArtifactActions({
  artifact,
  getDocumentContentById,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
}: ArtifactActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const visibleContent = isCurrentVersion
    ? artifact.content
    : getDocumentContentById(currentVersionIndex);

  const actionContext: ArtifactActionContext = {
    title: artifact.title,
    kind: artifact.kind,
    content: visibleContent,
    getDocumentContentById,
    handleVersionChange,
    currentVersionIndex,
    isCurrentVersion,
    mode,
    metadata,
    setMetadata,
  };

  const executeAction = async (
    onClick: (context: ArtifactActionContext) => Promise<void> | void
  ) => {
    setIsLoading(true);

    try {
      await Promise.resolve(onClick(actionContext));
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to execute action"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      {artifactDefinition.actions.map((action) => {
        const disabled =
          isLoading || artifact.status === "streaming"
            ? true
            : action.isDisabled
              ? action.isDisabled(actionContext)
              : false;

        const renderButton = (onClick?: () => void) => (
          <button
            aria-label={action.label ?? action.description}
            className={cn(
              "flex items-center justify-center rounded-full p-3 text-muted-foreground transition-all duration-150",
              "hover:text-foreground",
              "active:scale-95",
              "disabled:pointer-events-none disabled:opacity-30",
              {
                "text-foreground":
                  mode === "diff" && action.description === "View changes",
              }
            )}
            data-testid={getActionTestId(action.label ?? action.description)}
            disabled={disabled}
            onClick={onClick}
            type="button"
          >
            {action.icon}
            <span className="sr-only">
              {action.label ?? action.description}
            </span>
          </button>
        );

        if (Array.isArray(action.items)) {
          return (
            <DropdownMenu key={action.description} modal={false}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    {renderButton()}
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  {action.description}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" side="left" sideOffset={8}>
                {action.items.map((item) => {
                  const itemDisabled =
                    disabled || item.isDisabled?.(actionContext) || false;

                  return (
                    <DropdownMenuItem
                      data-testid={getActionTestId(
                        `${action.label ?? action.description}-${item.label}`
                      )}
                      disabled={itemDisabled}
                      key={item.label}
                      onSelect={(event) => {
                        event.preventDefault();
                        if (!itemDisabled) {
                          executeAction(item.onClick);
                        }
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        if (!action.onClick) {
          return null;
        }

        return (
          <Tooltip key={action.description}>
            <TooltipTrigger asChild>
              {renderButton(() => {
                executeAction(action.onClick);
              })}
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              {action.description}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export const ArtifactActions = memo(
  PureArtifactActions,
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) {
      return false;
    }
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
      return false;
    }
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
      return false;
    }
    if (prevProps.artifact.content !== nextProps.artifact.content) {
      return false;
    }
    if (prevProps.mode !== nextProps.mode) {
      return false;
    }

    return true;
  }
);
