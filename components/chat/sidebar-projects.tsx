"use client";

import { ChevronRight, Folder, FolderPlus, MoreHorizontal } from "lucide-react";
import type { User } from "next-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Project } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

const MAX_VISIBLE_PROJECTS = 5;

function ProjectSkeletons({ count = 3 }: { count?: number }) {
  const widths = [44, 32, 28, 64, 52];
  return (
    <div className="flex flex-col px-1">
      {widths.slice(0, count).map((w) => (
        <div className="flex h-7 items-center gap-2 rounded-lg px-2" key={w}>
          <div
            className="h-2.5 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-foreground/6"
            style={{ "--skeleton-width": `${w}%` } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

export function SidebarProjects({ user }: { user: User | undefined }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: projects,
    isLoading,
    mutate,
  } = useSWR<Project[]>(
    user ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects` : null,
    fetcher,
    { fallbackData: [], revalidateOnFocus: false }
  );

  const chatIdFromPath = pathname?.startsWith("/chat/")
    ? (pathname.split("/")[2] ?? null)
    : null;

  const { data: currentChat } = useSWR<{ projectId: string | null }>(
    chatIdFromPath
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatIdFromPath}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const currentChatProjectId = currentChat?.projectId ?? null;

  const visibleProjects = projects?.slice(0, MAX_VISIBLE_PROJECTS) ?? [];
  const moreProjects = projects?.slice(MAX_VISIBLE_PROJECTS) ?? [];
  const hasMore = moreProjects.length > 0;

  const handleCreate = async () => {
    const name = projectName.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.cause || "Failed to create project");
      }

      await mutate();
      setShowCreateDialog(false);
      setProjectName("");
      toast.success("Project created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project"
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel
          className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span>Projects</span>
          <ChevronRight
            className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            style={{ width: 12, height: 12 }}
          />
        </SidebarGroupLabel>

        {isOpen && (
          <>
            {isLoading ? (
              <ProjectSkeletons />
            ) : (
              <SidebarMenu className="gap-0">
                {/* New Project button */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="h-7 rounded-md text-[13px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-primary"
                    onClick={() => setShowCreateDialog(true)}
                    tooltip="New Project"
                  >
                    <FolderPlus className="size-4" />
                    <span className="font-normal">
                      New Project
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Visible projects */}
                {visibleProjects.map((project) => {
                  const isActive =
                    pathname === `/projects/${project.id}` ||
                    pathname?.startsWith(`/projects/${project.id}/`) ||
                    currentChatProjectId === project.id;
                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        asChild
                        className="h-7 rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                        isActive={isActive}
                        tooltip={project.name}
                      >
                        <Link
                          href={`/projects/${project.id}`}
                          onClick={() => setOpenMobile(false)}
                        >
                          <Folder className="size-4" />
                          <span className="truncate text-[13px] font-normal">
                            {project.name}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

                {/* More button */}
                {hasMore && (
                  <SidebarMenuItem>
                    <Popover>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton
                          className="h-7 rounded-lg text-sidebar-foreground/40 transition-colors duration-150 hover:bg-primary/10 hover:text-primary"
                          tooltip="More projects"
                        >
                          <MoreHorizontal className="size-4" />
                          <span className="text-[13px]">
                            More ({moreProjects.length})
                          </span>
                        </SidebarMenuButton>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-56 p-1"
                        side={isMobile ? "bottom" : "right"}
                      >
                        <div className="flex flex-col gap-0.5">
                          {isLoading ? (
                            <ProjectSkeletons count={3} />
                          ) : (
                            moreProjects.map((project) => {
                              const isActive =
                                pathname === `/projects/${project.id}` ||
                                pathname?.startsWith(
                                  `/projects/${project.id}/`
                                ) ||
                                currentChatProjectId === project.id;
                              return (
                                <Link
                                  className={`flex h-7 w-full items-center gap-2 rounded-lg px-2 text-[13px] transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground"}`}
                                  href={`/projects/${project.id}`}
                                  key={project.id}
                                  onClick={() => setOpenMobile(false)}
                                >
                                  <Folder className="size-4 shrink-0" />
                                  <span className="truncate">
                                    {project.name}
                                  </span>
                                </Link>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            )}
          </>
        )}
      </SidebarGroup>

      {/* Create Project Dialog */}
      <Dialog onOpenChange={setShowCreateDialog} open={showCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your conversations.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <Input
              autoFocus
              maxLength={100}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              value={projectName}
            />
            <DialogFooter className="mt-4">
              <Button
                onClick={() => setShowCreateDialog(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={!projectName.trim() || isCreating}
                type="submit"
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
