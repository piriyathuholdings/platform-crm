import { expect, test } from "@playwright/test";

const loginEmail = process.env.E2E_LOGIN_EMAIL || "business.admin@cmate.local";
const loginPassword = process.env.E2E_LOGIN_PASSWORD || "Admin#12345";

test("login and dashboard load", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/crm$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("redirect to login for protected route", async ({ context, page }) => {
  await context.clearCookies();
  await page.goto("/crm/deals/view/list");
  await expect(page).toHaveURL(/\/login/);
});

test("login keeps redirect target and lands on requested page", async ({ context, page }) => {
  await context.clearCookies();
  await page.goto("/crm/leads/view/list");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/crm/);
});
