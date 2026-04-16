import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { BillingOverview } from "@/components/billing/billing-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { getBillingPageData } from "@/lib/billing/service";

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingPageContent />
    </Suspense>
  );
}

async function BillingPageContent() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const billingData = await getBillingPageData({
    userId: session.user.id,
    userType: session.user.type,
  });

  return (
    <BillingOverview
      currentPlan={billingData.currentPlan}
      entitlements={billingData.entitlements}
      recentCheckouts={billingData.recentCheckouts}
      remainingCredits={billingData.remainingCredits}
      subscription={billingData.subscription}
    />
  );
}

function BillingFallback() {
  return (
    <section className="min-h-screen py-8 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
        <Skeleton className="mt-6 h-72 rounded-xl" />
      </div>
    </section>
  );
}
