import { auth } from "@/app/(auth)/auth";
import { getUsageData } from "@/lib/billing/service";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  const headers = { "Cache-Control": "private, no-store" };

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  try {
    const data = await getUsageData({
      userId: session.user.id,
      userType: session.user.type,
    });

    return Response.json(data, { headers });
  } catch {
    // The usage sidebar is best-effort. If billing/count lookups are temporarily
    // unavailable, let the UI degrade gracefully instead of surfacing a noisy
    // server error for every page load in development.
    return Response.json(
      { code: "usage_unavailable", message: "Usage data is temporarily unavailable." },
      { status: 503, headers }
    );
  }
}
