import { expect, test } from "@playwright/test";
import { freshPhone, signIn } from "./helpers";

test("Marathi and Hindi work on sign-in, status page and lead form", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "मराठी" }).click();
  await expect(page.getByRole("heading", { name: "साइन इन" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "mr"); // <html lang> follows locale
  await page.screenshot({ path: "e2e/shots/signin-mr.png" });

  // public status page in Marathi (stage names + next step come from the stage table)
  await page.goto("/status/demo-status-prashant-4f9c2a7e5b1d4c68a0e2f7b9d3c1a5e8");
  await expect(page.getByText("साहित्य पाठवले").first()).toBeVisible();
  await page.screenshot({ path: "e2e/shots/status-mr.png", fullPage: true });
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(page.getByText("सामग्री भेजी गई").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");

  // lead form in Marathi, signed in as a fresh homeowner (sign in in English, then switch)
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await signIn(page, freshPhone());
  await page.waitForURL("/");
  await page.getByRole("button", { name: "मराठी" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  await page.goto("/lead/new");
  await expect(page.getByText("टप्पा 1 / 5")).toBeVisible();
  await page.getByRole("button", { name: "पुढे" }).click(); // empty step -> Marathi validation
  await expect(page.getByText("कृपया एक उत्तर निवडा").first()).toBeVisible();
  await page.screenshot({ path: "e2e/shots/lead-mr.png" });
});
