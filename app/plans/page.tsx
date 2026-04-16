import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayPlans } from "@/lib/billing/plans";
import { getBillingPageData } from "@/lib/billing/service";
import type { BillingInterval } from "@/lib/billing/types";

type PlansPageProps = {
  searchParams?: Promise<{
    interval?: string | string[];
  }>;
};

function resolveBillingInterval(value?: string | string[]): BillingInterval {
  const interval = Array.isArray(value) ? value[0] : value;

  return interval === "monthly" ? "monthly" : "yearly";
}

export default function PlansPage({ searchParams }: PlansPageProps) {
  return (
    <Suspense fallback={<PlansPageFallback />}>
      <PlansPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PlansPageContent({ searchParams }: PlansPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const defaultBillingPeriod = resolveBillingInterval(
    resolvedSearchParams?.interval
  );
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <BillingDashboard
        currentPlan={null}
        defaultBillingPeriod={defaultBillingPeriod}
        displayPlans={getDisplayPlans()}
        isGuest={true}
        remainingCredits={null}
      />
    );
  }

  const billingData = await getBillingPageData({
    userId: session.user.id,
    userType: session.user.type,
  });

  return (
    <BillingDashboard
      currentPlan={billingData.currentPlan}
      defaultBillingPeriod={defaultBillingPeriod}
      displayPlans={billingData.displayPlans}
      isGuest={false}
      remainingCredits={billingData.remainingCredits}
    />
  );
}

function PlansPageFallback() {
  return (
    <section className="py-8 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-start">
          <Skeleton className="size-9 rounded-lg" />
        </div>

        <div className="mb-24 text-center">
          <div className="mb-6 flex flex-col items-center">
            <Skeleton className="h-10 w-72 rounded-2xl sm:w-96" />
            <Skeleton className="mt-4 h-5 w-full max-w-2xl rounded-full" />
            <Skeleton className="mt-2 h-5 w-5/6 max-w-xl rounded-full" />
          </div>

          <div className="relative flex items-center justify-center gap-2">
            <div className="rounded-md bg-background p-1">
              <div className="flex gap-1">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
            <div className="absolute top-10 left-1/2 flex translate-x-[50%] items-center gap-2">
              <Skeleton className="h-4 w-11 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>

        <div className="relative grid items-end gap-6 lg:grid-cols-3">
          {getDisplayPlans().map((plan) => (
            <article
              className="relative w-full overflow-hidden rounded-xl border bg-card shadow-sm sm:max-lg:mx-auto sm:max-lg:w-lg"
              key={plan.planSlug}
            >
              <div className="flex flex-col gap-6 p-6">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <Skeleton className="h-9 w-24 rounded-xl" />
                    <Skeleton className="absolute -right-5 size-28 rounded-full" />
                  </div>

                  <div className="mb-2 flex items-end gap-2">
                    <Skeleton className="h-7 w-8 rounded-lg" />
                    <Skeleton className="h-14 w-44 rounded-2xl" />
                    <Skeleton className="h-7 w-18 rounded-full" />
                  </div>
                  <Skeleton className="mt-4 h-5 w-full rounded-full" />
                  <Skeleton className="mt-2 h-5 w-3/4 rounded-full" />
                </div>

                <Skeleton className="h-10 w-full rounded-lg" />

                <div className="space-y-3">
                  <Skeleton className="mb-5 h-9 w-3/4 rounded-xl" />
                  {[
                    "credits",
                    "models",
                    "attachments",
                    "documents",
                    "projects",
                    "integrations",
                    "video",
                  ].map((featureSkeleton) => (
                    <div
                      className="flex items-center gap-3"
                      key={featureSkeleton}
                    >
                      <Skeleton className="size-5 rounded-full" />
                      <Skeleton className="h-5 flex-1 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
