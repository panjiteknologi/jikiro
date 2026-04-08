import { expect, test } from "@playwright/test";

test.describe("Authentication Pages", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("user@acme.com")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Create account" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("user@acme.com")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL("/register");
  });

  test("can navigate from register to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });

  test("preview pricing toggle updates prices and preserves redirect", async ({
    page,
  }) => {
    await page.goto("/register");

    const yearlyTab = page.getByRole("tab", { name: "Yearly" });
    const monthlyTab = page.getByRole("tab", { name: "Monthly" });
    const proPlanLink = page.getByRole("link", { name: "Get Pro" });

    await expect(yearlyTab).toHaveAttribute("data-state", "active");
    await expect(page.getByText("Rp 1.490k")).toBeVisible();
    await expect(proPlanLink).toHaveAttribute(
      "href",
      "/register?redirect=%2Fbilling%3Finterval%3Dyearly"
    );

    await monthlyTab.click();

    await expect(monthlyTab).toHaveAttribute("data-state", "active");
    await expect(page.getByText("Rp 149k")).toBeVisible();
    await expect(proPlanLink).toHaveAttribute(
      "href",
      "/register?redirect=%2Fbilling%3Finterval%3Dmonthly"
    );

    await page.goto("/login?redirect=%2Fbilling%3Finterval%3Dmonthly");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(
      "/register?redirect=%2Fbilling%3Finterval%3Dmonthly"
    );
  });
});
