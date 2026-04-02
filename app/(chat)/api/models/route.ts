import { auth } from "@/app/(auth)/auth";
import { getEntitlementsForTier } from "@/lib/billing/plans";
import { resolveBillingState } from "@/lib/billing/service";
import { chatModels, getCapabilities } from "@/lib/ai/models";

export async function GET() {
  const headers = {
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
  };

  const [curatedCapabilities, session] = await Promise.all([
    getCapabilities(),
    auth(),
  ]);
  const entitlements =
    session?.user?.id && session.user.type
      ? (
          await resolveBillingState({
            userId: session.user.id,
            userType: session.user.type,
          })
        ).entitlements
      : getEntitlementsForTier("guest");
  const allowedModels = chatModels.filter((model) =>
    entitlements.allowedModelIds.includes(model.id)
  );
  const capabilities = Object.fromEntries(
    allowedModels.map((model) => [model.id, curatedCapabilities[model.id]])
  );

  return Response.json({ capabilities, models: allowedModels }, { headers });
}
