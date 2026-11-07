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
