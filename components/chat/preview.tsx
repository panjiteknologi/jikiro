"use client";

import { CheckCircle2, Crown, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { type ElementType, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BillingInterval } from "@/lib/billing/types";
import { suggestions } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Jikiro from "@/public/svg/jikiro";

type PreviewPlan = {
  slug: string;
  name: string;
  price: Record<BillingInterval, number>;
  icon: ElementType;
  features: string[];
  cta: string;
  popular?: boolean;
};

const PREVIEW_PLANS: PreviewPlan[] = [
  {
    slug: "free",
    name: "Free",
    price: {
      monthly: 0,
      yearly: 0,
    },
    icon: Sparkles,
    features: [
      "100 AI credits/cycle",
      "Basic AI models",
      "File Attachments",
      "Basic Support",
    ],
    cta: "Get started",
  },
  {
    slug: "pro",
    name: "Pro",
    price: {
      monthly: 149_000,
      yearly: 1_490_000,
    },
    icon: Zap,
    features: [
      "1,500 AI credits/cycle",
      "Higher AI models",
      "Unlimited Projects",
      "Image Generation",
    ],
    cta: "Get Pro",
    popular: true,
  },
  {
    slug: "max",
    name: "Max",
    price: {
      monthly: 399_000,
      yearly: 3_990_000,
    },
    icon: Crown,
    features: [
      "5,000 AI credits/cycle",
      "Highest AI models",
      "Unlimited Projects",
      "Image & Video Generation",
    ],
    cta: "Get Max",
  },
];

function formatPrice(price: number) {
  if (price === 0) {
    return "Free";
  }

  return `Rp ${(price / 1000).toLocaleString("id-ID")}k`;
}

export function Preview() {
  const router = useRouter();
  const { data: session } = useSession();
  const [billingPeriod, setBillingPeriod] = useState<BillingInterval>("yearly");
  const isLoggedIn = Boolean(session?.user);

  const handleAction = (query?: string) => {
    const url = query ? `/?query=${encodeURIComponent(query)}` : "/";
    router.push(url);
  };

  const getPlanHref = (plan: PreviewPlan) => {
    if (plan.slug === "free") {
      return "/register";
    }

    const billingHref = `/plans?interval=${billingPeriod}`;

    return isLoggedIn
      ? billingHref
      : `/register?redirect=${encodeURIComponent(billingHref)}`;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tl-2xl bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/20 px-5">
        <div className="flex size-5 items-center justify-center">
          <Jikiro />
        </div>
        <span className="text-[13px] text-muted-foreground">Jikiro Bot</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            What can I help with?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ask a question, write code, or explore ideas.
          </p>
        </div>

        <div className="flex flex-row flex-wrap justify-center gap-2">
          {suggestions.map((suggestion) => (
            <button
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/20 hover:bg-muted/20"
              key={suggestion.id}
              onClick={() => handleAction(suggestion.prompt)}
              style={{ borderColor: suggestion.tint.border }}
              type="button"
            >
              <span className="text-base leading-none">{suggestion.emoji}</span>
              {suggestion.title}
            </button>
          ))}
        </div>

        <div className="w-full border-t border-border/30" />

        <div className="w-full">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            Plans &amp; Pricing
          </p>
          <Tabs
            className="mb-4 flex justify-center"
            onValueChange={(value) =>
              setBillingPeriod(value === "monthly" ? "monthly" : "yearly")
            }
            value={billingPeriod}
          >
            <TabsList className="h-auto rounded-md border border-border/60 bg-background p-1">
              <TabsTrigger
                className="px-2 py-1 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                value="monthly"
              >
                <span className="text-[11px] text-foreground">Monthly</span>
              </TabsTrigger>
              <TabsTrigger
                className="px-2 py-1 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                value="yearly"
              >
                <span className="text-[11px] text-foreground">Yearly</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-3 gap-3">
            {PREVIEW_PLANS.map((plan) => {
              const Icon = plan.icon;
              const activePrice = plan.price[billingPeriod];

              return (
                <div
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border bg-card/50 p-4",
                    plan.popular
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                  )}
                  key={plan.slug}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{plan.name}</span>
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>

                  <div>
                    <span className="text-xl font-bold leading-none">
                      {formatPrice(activePrice)}
                    </span>
                    {activePrice > 0 && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        /{billingPeriod === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </div>

                  <ul className="flex flex-col gap-1.5">
                    {plan.features.map((feature) => (
                      <li
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                        key={feature}
                      >
                        <CheckCircle2 className="size-3 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    className={cn(
                      "mt-auto rounded-xl py-1.5 text-center text-xs font-medium transition-colors",
                      plan.popular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-foreground hover:bg-muted/70"
                    )}
                    href={getPlanHref(plan)}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>
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
