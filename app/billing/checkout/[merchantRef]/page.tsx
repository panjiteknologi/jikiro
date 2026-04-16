import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { PaymentStatus } from "@/components/billing/payment-status";
import { Skeleton } from "@/components/ui/skeleton";
import { getBillingCheckoutByMerchantRef } from "@/lib/db/billing-queries";

type PaymentStatusPageProps = {
  params: Promise<{
    merchantRef: string;
  }>;
};

export default function PaymentStatusPage({ params }: PaymentStatusPageProps) {
  return (
    <Suspense fallback={<PaymentStatusFallback />}>
      <PaymentStatusContent params={params} />
    </Suspense>
  );
}

async function PaymentStatusContent({ params }: PaymentStatusPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { merchantRef } = await params;
  const checkout = await getBillingCheckoutByMerchantRef({
    merchantRef: decodeURIComponent(merchantRef),
  });

  if (!checkout || checkout.userId !== session.user.id) {
    notFound();
  }

  return <PaymentStatus checkout={checkout} />;
}

function PaymentStatusFallback() {
  return (
    <section className="min-h-screen py-8 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="mt-1 h-4 w-52 rounded-md" />
          </div>
        </div>
        <Skeleton className="mb-6 h-48 w-full rounded-xl" />
        <Skeleton className="mb-6 h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </section>
  );
}
