import { auth } from "@/app/(auth)/auth";
import { getAllGatewayModels } from "@/lib/ai/models";
import { resolveEntitlementsForTier } from "@/lib/billing/plans";
import { resolveBillingState } from "@/lib/billing/service";

export async function GET() {
  const headers = {
    "Cache-Control": "private, no-store",
  };

  const [catalog, session] = await Promise.all([getAllGatewayModels(), auth()]);
  const entitlements =
    session?.user?.id && session.user.type
      ? (
          await resolveBillingState({
            userId: session.user.id,
            userType: session.user.type,
          })
        ).entitlements
      : await resolveEntitlementsForTier({ tier: "guest" });
  const allowedModelsWithCapabilities = catalog.filter((model) =>
    entitlements.allowedModelIds.includes(model.id)
  );
  const capabilities = Object.fromEntries(
    allowedModelsWithCapabilities.map((model) => [model.id, model.capabilities])
  );
  const allowedModels = allowedModelsWithCapabilities.map(
    ({ capabilities: _capabilities, ...model }) => model
  );

  return Response.json({ capabilities, models: allowedModels }, { headers });
}
