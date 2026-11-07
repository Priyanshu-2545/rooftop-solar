import { expect, type Page } from "@playwright/test";

export const OTP = "123456"; // DEMO_OTP

export async function signIn(page: Page, phone: string) {
  await page.goto("/signin");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the code" })).toBeVisible();
  const first = page.getByLabel("1 / 6");
  await first.click();
  await page.keyboard.type(OTP, { delay: 20 });
  await page.getByRole("button", { name: "Sign in" }).click();
}

export const freshPhone = () => `91${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;

/** Homeowner signs in, submits a lead with the clear 340-unit sample bill and confirms it. Returns the phone and lead id. */
export async function submitConfirmedLead(page: Page, phone: string) {
  await signIn(page, phone);
  await page.waitForURL("/");
  await page.goto("/lead/new");
  await expect(async () => {
    await page.getByLabel("I own it").check();
    await page.getByLabel("Flat concrete (RCC)").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await page.getByLabel("Roof area").fill("420");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Monthly electricity bill (₹)").fill("3200");
  await page.getByLabel("Pincode").fill("440010");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Demo: use a sample bill").selectOption("bill-good-340.png");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/I agree that Company A/).check();
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await page.getByRole("button", { name: "Confirm and see my result" }).click();
  await expect(page.getByRole("heading", { name: "A surveyor will visit" })).toBeVisible();
  return page.url().split("/leads/")[1];
}
