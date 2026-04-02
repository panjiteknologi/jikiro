"use client";

import { suggestions } from "@/lib/constants";
import Jikiro from "@/public/svg/jikiro";
import { useRouter } from "next/navigation";

export function Preview() {
  const router = useRouter();

  const handleAction = (query?: string) => {
    const url = query ? `/?query=${encodeURIComponent(query)}` : "/";
    router.push(url);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tl-2xl bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/20 px-5">
        <div className="flex size-5 items-center justify-center">
          <Jikiro />
        </div>
        <span className="text-[13px] text-muted-foreground">Jikiro Bot</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            What can I help with?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ask a question, write code, or explore ideas.
          </p>
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-3">
          {suggestions.map((suggestion) => (
            <button
              className="group rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors duration-200 hover:border-foreground/20 hover:bg-muted/20"
              key={suggestion.id}
              onClick={() => handleAction(suggestion.prompt)}
              style={{
                borderColor: suggestion.tint.border,
              }}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-lg leading-none">
                  {suggestion.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {suggestion.title}
                  </div>
                  <p className="truncate text-[12px] leading-relaxed text-muted-foreground">
                    {suggestion.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <button
          className="flex w-full items-center rounded-2xl border border-border/40 bg-card/35 px-4 py-3 text-left text-[13px] text-muted-foreground/45 transition-colors hover:border-border/60 hover:bg-card/55 hover:text-muted-foreground/70"
          onClick={() => handleAction()}
          type="button"
        >
          Ask anything...
        </button>
      </div>
    </div>
  );
}
