import { auth } from "@/app/(auth)/auth";
import { listTripayChannels } from "@/lib/billing/tripay";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:billing").toResponse();
  }

  const channels = await listTripayChannels();

  return Response.json(
    { channels },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    }
  );
}
