"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActivityIcon } from "lucide-react";

type UsageData = {
  counts: { hour: number; fiveHours: number; week: number };
  credits: { included: number; remaining: number };
  limits: { hour: number; fiveHours: number; week: number };
};

function getBarColor(percentage: number) {
  if (percentage >= 85) return "bg-red-500";
  if (percentage >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

function UsageBar({
  count,
  label,
  limit,
}: {
  count: number;
  label: string;
  limit: number;
}) {
  const percentage = limit > 0 ? Math.min(100, (count / limit) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/50">
        <span>{label}</span>
        <span>
          {count}/{limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-sidebar-foreground/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function UsageProgress() {
  const [data, setData] = useState<UsageData | null>(null);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Graceful degradation
    }
  }, []);

  useEffect(() => {
    fetchUsage();

    const handler = () => fetchUsage();
    window.addEventListener("usage-refresh", handler);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchUsage();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("usage-refresh", handler);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchUsage]);

  if (!data) return null;

  const creditsUsed = data.credits.included - data.credits.remaining;
  const creditPercentage =
    data.credits.included > 0
      ? Math.min(100, (creditsUsed / data.credits.included) * 100)
      : 0;

  if (isCollapsed) {
    return (
      <SidebarGroup className="px-2 py-1 group-data-[collapsible=icon]:px-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center">
              <ActivityIcon
                className={`size-4 ${creditPercentage >= 85 ? "text-red-500" : creditPercentage >= 60 ? "text-amber-500" : "text-sidebar-foreground/40"}`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <p>Credits: {data.credits.remaining}/{data.credits.included}</p>
            <p>Hour: {data.counts.hour}/{data.limits.hour}</p>
            <p>5h: {data.counts.fiveHours}/{data.limits.fiveHours}</p>
            <p>Week: {data.counts.week}/{data.limits.week}</p>
          </TooltipContent>
        </Tooltip>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="px-3 py-2">
      <SidebarGroupLabel className="mb-1 px-0 text-[11px] font-medium text-sidebar-foreground/40">
        Usage
      </SidebarGroupLabel>
      <SidebarGroupContent className="space-y-2">
        <UsageBar
          label="Credits"
          count={creditsUsed}
          limit={data.credits.included}
        />
        <UsageBar
          label="Per hour"
          count={data.counts.hour}
          limit={data.limits.hour}
        />
        <UsageBar
          label="Per 5 hours"
          count={data.counts.fiveHours}
          limit={data.limits.fiveHours}
        />
        <UsageBar
          label="Per week"
          count={data.counts.week}
          limit={data.limits.week}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
