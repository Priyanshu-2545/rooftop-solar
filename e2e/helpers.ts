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
    await page.getByLabel("Your name (optional)").fill("Asha Patil");
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

/** Full UI path to an accepted quote. Returns contexts and the project id. */
export async function createAcceptedProject(browser: import("@playwright/test").Browser) {
  const homeCtx = await browser.newContext({ viewport: { width: 393, height: 851 } });
  const home = await homeCtx.newPage();
  const leadId = await submitConfirmedLead(home, freshPhone());
  const salesCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const sales = await salesCtx.newPage();
  await signIn(sales, "9000000001");
  await sales.waitForURL("/leads");
  await sales.goto(`/leads/${leadId}/quote`);
  await expect(sales.getByText("₹87,000").first()).toBeVisible();
  await sales.getByRole("button", { name: "Send quote" }).click();
  await expect(sales.getByText(/Preview as the homeowner sees it/)).toBeVisible();
  await home.goto(`/leads/${leadId}`);
  await home.getByRole("link", { name: "Your solar quote" }).click();
  await home.getByRole("button", { name: "Accept and pay advance" }).click();
  await home.getByRole("link", { name: "See my project" }).click();
  await expect(home.getByText("Advance received").first()).toBeVisible();
  const projectId = home.url().split("/projects/")[1];
  return { home, homeCtx, sales, salesCtx, projectId };
}
