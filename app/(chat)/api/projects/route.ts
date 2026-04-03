import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { resolveBillingState } from "@/lib/billing/service";
import { createProject, getProjectsByUserId } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  systemPrompt: z.string().max(4000).nullish(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const projects = await getProjectsByUserId({ userId: session.user.id });

  return Response.json(projects);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const billingState = await resolveBillingState({
    userId: session.user.id,
    userType: session.user.type,
  });

  if (!billingState.entitlements.features.projects) {
    return new ChatbotError("forbidden:project").toResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new ChatbotError("bad_request:project").toResponse();
  }

  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return new ChatbotError("bad_request:project").toResponse();
  }

  const created = await createProject({
    userId: session.user.id,
    name: parsed.data.name,
    systemPrompt: parsed.data.systemPrompt ?? null,
  });

  return Response.json(created, { status: 201 });
}
