import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ModelSettingsPanel } from "@/components/settings/model-settings-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { getModelSettingsData } from "@/lib/billing/service";

export default function ModelSettingsPage() {
  return (
    <Suspense fallback={<ModelSettingsPageFallback />}>
      <ModelSettingsPageContent />
    </Suspense>
  );
}

async function ModelSettingsPageContent() {
  const session = await auth();

  if (!session?.user?.id || session.user.type !== "regular") {
    redirect("/login");
  }

  const initialData = await getModelSettingsData({
    userId: session.user.id,
    userType: session.user.type,
  });

  return <ModelSettingsPanel initialData={initialData} />;
}

function ModelSettingsPageFallback() {
  return (
    <section className="min-h-dvh bg-background py-8 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-6 w-28 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-56 rounded-2xl" />
              <Skeleton className="h-5 w-full max-w-2xl rounded-full" />
              <Skeleton className="h-5 w-5/6 max-w-xl rounded-full" />
            </div>
          </div>

          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-40 rounded-xl" />
              <Skeleton className="h-5 w-full rounded-full" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-44 rounded-xl" />
              <Skeleton className="h-5 w-3/4 rounded-full" />
              <Skeleton className="h-10 w-full rounded-2xl" />
              <div className="grid gap-3 md:grid-cols-2">
                {["one", "two", "three", "four"].map((key) => (
                  <Skeleton className="h-32 w-full rounded-2xl" key={key} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
