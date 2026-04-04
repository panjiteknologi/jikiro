import { generateImage } from "ai";
import { getImageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const imageDocumentHandler = createDocumentHandler<"image">({
  kind: "image",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    const { image } = await generateImage({
      model: getImageModel(modelId),
      prompt: title,
    });

    dataStream.write({
      type: "data-imageDelta",
      data: image.base64,
      transient: true,
    });

    return image.base64;
  },
  onUpdateDocument: async ({ description, dataStream, modelId }) => {
    const { image } = await generateImage({
      model: getImageModel(modelId),
      prompt: description,
    });

    dataStream.write({
      type: "data-imageDelta",
      data: image.base64,
      transient: true,
    });

    return image.base64;
  },
});
