import { auth } from "@/app/(auth)/auth";
import {
  deleteAttachmentAssetById,
  getAttachmentAssetsByIds,
  getProjectById,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { deleteFileFromS3 } from "@/lib/storage/s3";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const { id: projectId, assetId } = await params;

  const project = await getProjectById({
    id: projectId,
    userId: session.user.id,
  });

  if (!project) {
    return new ChatbotError("not_found:project").toResponse();
  }

  const [asset] = await getAttachmentAssetsByIds({
    ids: [assetId],
    userId: session.user.id,
  });

  if (!asset || asset.projectId !== projectId) {
    return new ChatbotError("not_found:project").toResponse();
  }

  await deleteAttachmentAssetById({
    id: assetId,
    userId: session.user.id,
  });

  if (!asset.storageKey.startsWith("project-text:")) {
    await deleteFileFromS3(asset.storageKey).catch((error) => {
      console.error("Failed to delete project file from S3", {
        assetId,
        projectId,
        error,
      });
    });
  }

  return new Response(null, { status: 204 });
}
