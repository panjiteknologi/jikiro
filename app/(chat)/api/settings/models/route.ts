import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getModelSettingsData,
  updateModelSettingsSelection,
} from "@/lib/billing/service";
import { ChatbotError } from "@/lib/errors";

const updateSelectedModelsSchema = z.object({
  selectedModelIds: z.array(z.string().min(1)).max(100),
});

const headers = {
  "Cache-Control": "private, no-store",
};

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:billing").toResponse();
  }

  if (session.user.type !== "regular") {
    return new ChatbotError("forbidden:billing").toResponse();
  }

  const data = await getModelSettingsData({
    userId: session.user.id,
    userType: session.user.type,
  });

  return Response.json(data, { headers });
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:billing").toResponse();
  }

  if (session.user.type !== "regular") {
    return new ChatbotError("forbidden:billing").toResponse();
  }

  const parsed = updateSelectedModelsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return new ChatbotError("bad_request:billing").toResponse();
  }

  const data = await updateModelSettingsSelection({
    selectedModelIds: parsed.data.selectedModelIds,
    userId: session.user.id,
    userType: session.user.type,
  });

  return Response.json(data, { headers });
}
