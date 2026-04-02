"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  GatewayModelWithCapabilities,
  ModelCapabilities,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";

type ModelSettingsPanelProps = {
  initialData: {
    catalogSource: "gateway";
    eligibleModels: GatewayModelWithCapabilities[];
    freeModelIds: string[];
    selectedModelIds: string[];
    selectionLimit: number | null;
    tier: "free" | "pro" | "max";
  };
};

const providerNames: Record<string, string> = {
  alibaba: "Alibaba",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
  minimax: "MiniMax",
  mistral: "Mistral",
  openai: "OpenAI",
  xai: "xAI",
};

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function getCapabilityBadges(capabilities: ModelCapabilities) {
  return [
    capabilities.tools ? "Tools" : null,
    capabilities.vision ? "Vision" : null,
    capabilities.reasoning ? "Reasoning" : null,
  ].filter(Boolean) as string[];
}

function getDefaultSelectedModelIds({
  eligibleModels,
  selectionLimit,
  tier,
}: ModelSettingsPanelProps["initialData"]) {
  if (tier === "max") {
    return eligibleModels.map((model) => model.id);
  }

  if (typeof selectionLimit === "number") {
    return eligibleModels.slice(0, selectionLimit).map((model) => model.id);
  }

  return eligibleModels.map((model) => model.id);
}

export function ModelSettingsPanel({ initialData }: ModelSettingsPanelProps) {
  const [selectedModelIds, setSelectedModelIds] = useState(
    initialData.selectedModelIds
  );
  const [persistedSelectedModelIds, setPersistedSelectedModelIds] = useState(
    initialData.selectedModelIds
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "error" | "success" | null;
    value: string | null;
  }>({ tone: null, value: null });

  const isReadOnly = initialData.tier === "free";
  const defaultSelectedModelIds = getDefaultSelectedModelIds(initialData);
  const isDirty = !arraysEqual(selectedModelIds, persistedSelectedModelIds);
  const filteredModels = initialData.eligibleModels.filter((model) => {
    if (!deferredQuery) {
      return true;
    }

    const haystack = [
      model.name,
      model.provider,
      model.id,
      model.description,
    ].join(" ");

    return haystack.toLowerCase().includes(deferredQuery);
  });

  const groupedModels = filteredModels.reduce<
    Record<string, GatewayModelWithCapabilities[]>
  >((groups, model) => {
    if (!groups[model.provider]) {
      groups[model.provider] = [];
    }
    groups[model.provider].push(model);
    return groups;
  }, {});
  const sortedProviders = Object.keys(groupedModels).sort((left, right) =>
    left.localeCompare(right)
  );

  function toggleModel(modelId: string) {
    if (isReadOnly) {
      return;
    }

    setStatusMessage({ tone: null, value: null });

    if (selectedModelIds.includes(modelId)) {
      if (selectedModelIds.length === 1) {
        setStatusMessage({
          tone: "error",
          value: "Keep at least one model selected.",
        });
        return;
      }

      setSelectedModelIds(selectedModelIds.filter((id) => id !== modelId));
      return;
    }

    if (
      typeof initialData.selectionLimit === "number" &&
      selectedModelIds.length >= initialData.selectionLimit
    ) {
      setStatusMessage({
        tone: "error",
        value: `This plan lets you select up to ${initialData.selectionLimit} models.`,
      });
      return;
    }

    const nextSelection = new Set(selectedModelIds);
    nextSelection.add(modelId);
    setSelectedModelIds(
      initialData.eligibleModels
        .map((model) => model.id)
        .filter((id) => nextSelection.has(id))
    );
  }

  async function saveSelection() {
    if (isReadOnly || !isDirty) {
      return;
    }

    setIsSaving(true);
    setStatusMessage({ tone: null, value: null });

    try {
      const response = await fetch("/api/settings/models", {
        body: JSON.stringify({ selectedModelIds }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatusMessage({
          tone: "error",
          value:
            payload?.cause ??
            payload?.message ??
            "Could not save your model settings.",
        });
        return;
      }

      setSelectedModelIds(payload.selectedModelIds);
      setPersistedSelectedModelIds(payload.selectedModelIds);
      setStatusMessage({
        tone: "success",
        value: "Model settings saved.",
      });
    } catch {
      setStatusMessage({
        tone: "error",
        value: "Network error while saving model settings.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="min-h-dvh bg-background py-8 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Badge variant="outline">
              {initialData.tier === "free"
                ? "Free"
                : initialData.tier === "pro"
                  ? "Pro"
                  : "Max"}{" "}
              model access
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Model settings
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Choose which AI models appear in your chat selector. Credits
                still follow live AI Gateway usage, so this page only controls
                access and availability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/billing">Back to billing</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Selection summary</CardTitle>
              <CardDescription>
                {isReadOnly
                  ? "Free accounts always use the curated five-model starter set."
                  : "Your chat selector will only show the models you keep active here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-input/20 p-4">
                <div className="text-sm text-muted-foreground">
                  Active models
                </div>
                <div className="mt-1 text-3xl font-semibold text-foreground">
                  {selectedModelIds.length}
                  {typeof initialData.selectionLimit === "number"
                    ? ` / ${initialData.selectionLimit}`
                    : ""}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Catalog: {initialData.catalogSource}
                </Badge>
                <Badge variant="outline">
                  {isReadOnly
                    ? "Read-only"
                    : typeof initialData.selectionLimit === "number"
                      ? `Limit ${initialData.selectionLimit}`
                      : "All eligible models"}
                </Badge>
              </div>

              {statusMessage.value ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm",
                    statusMessage.tone === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                >
                  {statusMessage.value}
                </div>
              ) : null}

              {isReadOnly ? (
                <Button asChild className="w-full">
                  <Link href="/billing">Upgrade to customize models</Link>
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    disabled={!isDirty || isSaving}
                    onClick={saveSelection}
                  >
                    {isSaving ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    className="w-full"
                    disabled={
                      isSaving ||
                      arraysEqual(selectedModelIds, defaultSelectedModelIds)
                    }
                    onClick={() => {
                      setSelectedModelIds(defaultSelectedModelIds);
                      setStatusMessage({ tone: null, value: null });
                    }}
                    variant="outline"
                  >
                    Reset to defaults
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {isReadOnly ? "Included models" : "Eligible models"}
              </CardTitle>
              <CardDescription>
                {isReadOnly
                  ? "These five models are included on Free and cannot be changed."
                  : "Search and toggle the models you want available in chat."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models by name, provider, or id..."
                value={query}
              />

              {filteredModels.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  No models match your search.
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedProviders.map((provider) => (
                    <div className="space-y-3" key={provider}>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {providerNames[provider] ?? provider}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {groupedModels[provider].map((model) => {
                          const isSelected = selectedModelIds.includes(
                            model.id
                          );
                          const capabilityBadges = getCapabilityBadges(
                            model.capabilities
                          );

                          return (
                            <button
                              className={cn(
                                "rounded-2xl border p-4 text-left transition-colors",
                                isReadOnly
                                  ? "cursor-default border-border/60 bg-input/10"
                                  : isSelected
                                    ? "border-primary/60 bg-primary/5"
                                    : "border-border/60 bg-input/10 hover:bg-input/30"
                              )}
                              key={model.id}
                              onClick={() => toggleModel(model.id)}
                              type="button"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="font-medium text-foreground">
                                    {model.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {model.id}
                                  </div>
                                </div>

                                <div className="flex flex-wrap justify-end gap-2">
                                  {initialData.freeModelIds.includes(
                                    model.id
                                  ) ? (
                                    <Badge variant="outline">Free</Badge>
                                  ) : null}
                                  {isSelected ? <Badge>Selected</Badge> : null}
                                </div>
                              </div>

                              <p className="mt-3 text-sm text-muted-foreground">
                                {model.description}
                              </p>

                              {capabilityBadges.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {capabilityBadges.map((badge) => (
                                    <Badge key={badge} variant="outline">
                                      {badge}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
