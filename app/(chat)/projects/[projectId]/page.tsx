"use client";

import { formatDistanceToNow } from "date-fns";
import {
  FolderIcon,
  FolderOpenIcon,
  MessageSquareIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { ProjectResourcesPanel } from "@/components/projects/resources/project-resources-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Chat, Project } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

type ProjectChatListItem = Pick<
  Chat,
  "id" | "title" | "createdAt" | "visibility" | "projectId" | "userId"
> & {
  lastMessage: {
    role: string;
    preview: string;
    createdAt: string;
  } | null;
};

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const { data: project, isLoading: projectLoading } = useSWR<Project>(
    projectId ? `${API_BASE}/api/projects/${projectId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: chats, isLoading: chatsLoading } = useSWR<
    ProjectChatListItem[]
  >(
    projectId ? `${API_BASE}/api/projects/${projectId}/chats?limit=50` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (projectLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <FolderIcon className="size-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium">Project not found</p>
          <p className="text-sm text-muted-foreground">
            This project may have been deleted or doesn&apos;t exist.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const chatList: ProjectChatListItem[] = chats ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <FolderOpenIcon className="size-7 shrink-0 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
      </div>

      {/* New chat bar */}
      <button
        type="button"
        onClick={() => router.push(`/projects/${projectId}/new`)}
        className="mb-8 flex w-full items-center gap-3 rounded-full border border-border bg-input/30 px-4 py-3 text-left text-muted-foreground shadow-sm transition-colors hover:bg-input/50 hover:text-foreground"
      >
        <PlusIcon className="size-4 shrink-0" />
        <span className="text-sm">New chat in {project.name}</span>
      </button>

      {/* Tabs */}
      <Tabs defaultValue="chats">
        <TabsList
          variant="line"
          className="mb-4 h-auto w-full justify-start gap-0 rounded-none border-b border-border p-0"
        >
          <TabsTrigger
            value="chats"
            className="-mb-px flex-none gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 font-medium text-muted-foreground after:hidden hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground"
          >
            Chats
          </TabsTrigger>
          <TabsTrigger
            value="sources"
            className="-mb-px flex-none gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 font-medium text-muted-foreground after:hidden hover:text-foreground data-[state=active]:border-b-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground"
          >
            Sources
          </TabsTrigger>
        </TabsList>

        {/* Chats tab */}
        <TabsContent value="chats">
          {chatsLoading ? (
            <ChatListSkeleton />
          ) : chatList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <MessageSquareIcon className="size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No chats in this project yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {chatList.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-start justify-between gap-4 py-3.5 hover:bg-muted/40 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    {chat.lastMessage?.preview ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {chat.lastMessage.preview}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(chat.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sources tab */}
        <TabsContent value="sources">
          <ProjectResourcesPanel projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChatListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-4 py-3.5 px-2"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="mb-8 h-12 w-full rounded-full" />
      <Skeleton className="mb-4 h-9 w-40 rounded-lg" />
      <ChatListSkeleton />
    </div>
  );
}
