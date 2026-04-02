import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "chatbot" });

  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  process.env.WORKFLOW_POSTGRES_URL ??= process.env.POSTGRES_URL;

  const { getWorld } = await import("workflow/runtime");
  await getWorld().start?.();
}
