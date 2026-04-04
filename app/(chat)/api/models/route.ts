import { auth } from "@/app/(auth)/auth";
import { getAllGatewayModels } from "@/lib/ai/models";
import { resolveBillingState } from "@/lib/billing/service";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const headers = {
    "Cache-Control": "private, no-store",
  };

  const [catalog, session] = await Promise.all([getAllGatewayModels(), auth()]);

  if (!session?.user?.id || !session.user.type) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { entitlements } = await resolveBillingState({
    userId: session.user.id,
    userType: session.user.type,
  });
  const allowedModelsWithCapabilities = catalog.filter((model) =>
    entitlements.allowedModelIds.includes(model.id)
  );
  const capabilities = Object.fromEntries(
    allowedModelsWithCapabilities.map((model) => [model.id, model.capabilities])
  );
  const allowedModels = allowedModelsWithCapabilities.map(
    ({ capabilities: _capabilities, ...model }) => model
  );

  return Response.json({ capabilities, models: allowedModels, tier: entitlements.tier }, { headers });
}
