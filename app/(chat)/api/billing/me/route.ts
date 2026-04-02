import { auth } from "@/app/(auth)/auth";
import { getBillingPageData } from "@/lib/billing/service";
import { getTripayConfig } from "@/lib/billing/tripay";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:billing").toResponse();
  }

  const data = await getBillingPageData({
    userId: session.user.id,
    userType: session.user.type,
  });

  return Response.json({
    ...data,
    tripayConfigured: Boolean(getTripayConfig()),
  });
}
