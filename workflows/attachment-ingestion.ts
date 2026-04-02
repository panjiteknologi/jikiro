import {
  type AttachmentWorkflowInput,
  runAttachmentAssetIngestion,
} from "@/workflows/attachment-ingestion-steps";

export async function ingestAttachmentAssetWorkflow(
  input: AttachmentWorkflowInput
) {
  "use workflow";

  return await runAttachmentAssetIngestion(input);
}
