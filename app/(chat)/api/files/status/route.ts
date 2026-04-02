import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getAttachmentAssetsByIds } from "@/lib/db/queries";

const QuerySchema = z.object({
  ids: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
    .refine((ids) => ids.length > 0, {
      message: "At least one attachment id is required",
    }),
});

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = QuerySchema.safeParse({
    ids: searchParams.get("ids"),
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: parsedQuery.error.errors[0]?.message ?? "Invalid attachment ids",
      },
      { status: 400 }
    );
  }

  const attachments = await getAttachmentAssetsByIds({
    ids: parsedQuery.data.ids,
    userId: session.user.id,
  });

  return NextResponse.json({
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      status: attachment.status,
      error: attachment.error,
    })),
  });
}
