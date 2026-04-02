"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { UISuggestion } from "@/lib/editor/suggestions";
import { Button } from "../ui/button";
import { CrossIcon, SparklesIcon } from "./icons";

export const SuggestionDialog = ({
  suggestion,
  onApply,
  onClose,
}: {
  suggestion: UISuggestion;
  onApply: () => void;
  onClose: () => void;
}) => {
  return (
    <AnimatePresence>
      <div className="sticky inset-0 z-40 h-full w-full">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            }
          }}
          role="presentation"
        />
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-1/2 top-1/2 z-50 flex w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-3xl border border-border/60 bg-background/95 p-5 font-sans text-sm backdrop-blur-xl"
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          key={suggestion.id}
          transition={{ duration: 0.15 }}
        >
          <div className="relative flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-2xl border border-border/60 bg-transparent text-muted-foreground">
                <SparklesIcon size={14} />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Suggestion
                </div>
                <div className="font-medium tracking-tight text-foreground">
                  Refine this draft
                </div>
              </div>
            </div>
            <button
              className="flex size-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <CrossIcon size={12} />
            </button>
          </div>
          <div className="relative rounded-2xl border border-border/50 bg-transparent px-4 py-3 text-muted-foreground leading-relaxed">
            {suggestion.description}
          </div>
          <div className="relative flex gap-2">
            <Button
              className="w-fit rounded-full px-4 py-2"
              onClick={onApply}
              variant="outline"
            >
              Apply
            </Button>
            <Button
              className="w-fit rounded-full px-4 py-2"
              onClick={onClose}
              variant="ghost"
            >
              Dismiss
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
