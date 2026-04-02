import { expect, test } from "@playwright/test";

test.describe("Billing Page", () => {
  test("shows pricing tiers and guest upgrade CTA", async ({ page }) => {
    await page.goto("/billing");

    await expect(
      page.getByRole("heading", { name: "Billing, credits, and plan controls" })
    ).toBeVisible();
    await expect(page.getByText("Free").first()).toBeVisible();
    await expect(page.getByText("Pro").first()).toBeVisible();
    await expect(page.getByText("Max").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create account to upgrade" }).first()
    ).toBeVisible();
  });

  test("returns billing summary payload", async ({ page }) => {
    const response = await page.request.get("/api/billing/me");
    expect(response.ok()).toBeTruthy();

    const json = await response.json();

    expect(Array.isArray(json.displayPlans)).toBeTruthy();
    expect(json.displayPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ planSlug: "free" }),
        expect.objectContaining({ planSlug: "pro" }),
        expect.objectContaining({ planSlug: "max" }),
      ])
    );
  });

  test("redirects guests away from model settings", async ({ page }) => {
    await page.goto("/settings/models");

    await expect(page).toHaveURL("/login");
  });
});

test.describe("Tier model gating", () => {
  test("guest/free session receives only guest-safe models", async ({
    page,
  }) => {
    await page.goto("/");

    const modelPayload = await page.evaluate(async () => {
      const response = await fetch("/api/models");
      return response.json();
    });

    expect(modelPayload.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "deepseek/deepseek-v3.2" }),
        expect.objectContaining({ id: "mistral/mistral-small" }),
        expect.objectContaining({ id: "openai/gpt-5-nano" }),
      ])
    );
    expect(modelPayload.models).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "moonshotai/kimi-k2-0905" }),
        expect.objectContaining({ id: "xai/grok-4.1-fast-non-reasoning" }),
      ])
    );
  });
});
