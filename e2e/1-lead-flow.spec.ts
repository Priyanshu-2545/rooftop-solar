import { expect, test } from "@playwright/test";
import { freshPhone, signIn } from "./helpers";

test("homeowner: sign in, submit lead, confirm bill, see a kind plain result", async ({ page }) => {
  await signIn(page, freshPhone());
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Get a solar estimate" }).first().click();

  // Step 1-5, one question group per step
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  // retry until hydrated: a click before React attaches handlers is a no-op
  await expect(async () => {
    await page.getByLabel("I own it").check();
    await page.getByLabel("Flat concrete (RCC)").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await page.getByLabel("Roof area").fill("420");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Monthly electricity bill (₹)").fill("₹3,200");
  await page.getByLabel("Pincode").fill("440010");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Demo: use a sample bill").selectOption("bill-good-340.png");
  await page.screenshot({ path: "e2e/shots/lead-step4.png" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/I agree that Company A/).check();
  await page.getByRole("button", { name: "Get my estimate" }).click();

  // Bill review: image beside values, nothing scored yet
  await expect(page.getByRole("heading", { name: "Check what we read" })).toBeVisible();
  await expect(page.getByAltText("Your electricity bill")).toBeVisible();
  await expect(page.getByText("340")).toBeVisible();
  await page.screenshot({ path: "e2e/shots/bill-review.png", fullPage: true });
  await page.getByRole("button", { name: "Confirm and see my result" }).click();

  // Result
  await expect(page.getByRole("heading", { name: "A surveyor will visit" })).toBeVisible();
  await expect(page.getByText("3", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/rejected/i)).toHaveCount(0);
  await page.screenshot({ path: "e2e/shots/result-high.png", fullPage: true });
});
