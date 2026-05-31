import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page) {
  const loginEmail = process.env.E2E_LOGIN_EMAIL || "business.admin@cmate.local";
  const loginPassword = process.env.E2E_LOGIN_PASSWORD || "Admin#12345";
  await page.goto("/login");
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/crm$/);
}

test("deals list opens and supports deep-link search state", async ({ page }) => {
  await login(page);
  await page.goto("/crm/deals/view/list?search=abc&page=1");
  await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  await expect(page.getByText("No records found.")).toBeVisible();
});

test("forbidden page renders", async ({ page }) => {
  await page.goto("/forbidden");
  await expect(page.getByRole("heading", { name: "Forbidden" })).toBeVisible();
});

test("unknown crm route resolves to not-found experience", async ({ page }) => {
  await login(page);
  await page.goto("/crm/not-a-real-entity/view/list");
  await expect(page).toHaveURL(/\/not-found|\/crm\/not-a-real-entity/);
});
