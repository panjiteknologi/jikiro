import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPlanDefinition,
  getPlanOffer,
  isPaidPlan,
} from "@/lib/billing/plans";
import { listTripayChannels } from "@/lib/billing/tripay";
import type { TripayChannel } from "@/lib/billing/tripay";
import type { BillingInterval, PlanSlug } from "@/lib/billing/types";

const DUMMY_CHANNELS: TripayChannel[] = [
  // Virtual Account
  { code: "BRIVA", name: "BRI Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 4000, feeMerchant: null },
  { code: "BNIVA", name: "BNI Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 4000, feeMerchant: null },
  { code: "MANDIRIVA", name: "Mandiri Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 4000, feeMerchant: null },
  { code: "BCAVA", name: "BCA Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 5500, feeMerchant: null },
  { code: "BSIVA", name: "BSI Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 4000, feeMerchant: null },
  { code: "CIMBVA", name: "CIMB Niaga Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 4000, feeMerchant: null },
  { code: "PERMATAVA", name: "Permata Virtual Account", group: "Virtual Account", type: "virtual_account", feeCustomer: 4000, feeMerchant: null },
  // E-Wallet
  { code: "QRIS", name: "QRIS", group: "E-Wallet", type: "ewallet", feeCustomer: 0, feeMerchant: null },
  { code: "QRISC", name: "QRIS (Customizable)", group: "E-Wallet", type: "ewallet", feeCustomer: 0, feeMerchant: null },
  { code: "OVO", name: "OVO", group: "E-Wallet", type: "ewallet", feeCustomer: 0, feeMerchant: null },
  { code: "DANA", name: "DANA", group: "E-Wallet", type: "ewallet", feeCustomer: 0, feeMerchant: null },
  { code: "SHOPEEPAY", name: "ShopeePay", group: "E-Wallet", type: "ewallet", feeCustomer: 0, feeMerchant: null },
  // Convenience Store
  { code: "ALFAMART", name: "Alfamart", group: "Convenience Store", type: "convenience_store", feeCustomer: 5000, feeMerchant: null },
  { code: "INDOMARET", name: "Indomaret", group: "Convenience Store", type: "convenience_store", feeCustomer: 5000, feeMerchant: null },
];

type CheckoutPageProps = {
  searchParams?: Promise<{
    interval?: string | string[];
    plan?: string | string[];
  }>;
};

function resolveParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function CheckoutPage({ searchParams }: CheckoutPageProps) {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckoutPageContent({ searchParams }: CheckoutPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolved = searchParams ? await searchParams : undefined;
  const planSlug = resolveParam(resolved?.plan) as PlanSlug | undefined;
  const interval = resolveParam(resolved?.interval) as
    | BillingInterval
    | undefined;

  if (
    !planSlug ||
    !interval ||
    !isPaidPlan(planSlug) ||
    (interval !== "monthly" && interval !== "yearly")
  ) {
    redirect("/billing");
  }

  const [tripayChannels, planDef, planOffer] = await Promise.all([
    listTripayChannels(),
    Promise.resolve(getPlanDefinition(planSlug)),
    Promise.resolve(getPlanOffer(planSlug, interval)),
  ]);

  const channels = tripayChannels.length > 0 ? tripayChannels : DUMMY_CHANNELS;

  return (
    <CheckoutForm
      channels={channels}
      interval={interval}
      planName={planDef.name}
      planSlug={planSlug}
      priceIdr={planOffer.priceIdr}
    />
  );
}

function CheckoutFallback() {
  return (
    <section className="min-h-screen py-8 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="mt-1 h-4 w-40 rounded-md" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
