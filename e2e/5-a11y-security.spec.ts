import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshPhone, signIn } from "./helpers";

// 360px phone width: the smallest we support.
test.use({ viewport: { width: 360, height: 740 } });

async function audit(page: import("@playwright/test").Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: accessibility violations`).toEqual([]);
}
async function noHorizontalScroll(page: import("@playwright/test").Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("accessibility (axe, WCAG 2.2 AA) and no horizontal scroll at 360px", async ({ page }) => {
  await page.goto("/signin");
  await audit(page, "signin"); await noHorizontalScroll(page);
  await page.goto("/status/demo-status-prashant-4f9c2a7e5b1d4c68a0e2f7b9d3c1a5e8");
  await audit(page, "status"); await noHorizontalScroll(page);
  await signIn(page, freshPhone());
  await page.waitForURL("/");
  await audit(page, "home (empty state)"); await noHorizontalScroll(page);
  await page.goto("/lead/new");
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  await audit(page, "lead form step 1"); await noHorizontalScroll(page);
});

test("security headers on every page", async ({ request }) => {
  const r = await request.get("/signin");
  const h = r.headers();
  expect(h["content-security-policy"]).toMatch(/default-src 'self'/);
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(h["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
  expect(h["content-security-policy"]).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=(self)");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("deny by default: anonymous users and wrong roles are turned away", async ({ page, request }) => {
  for (const path of ["/", "/leads", "/projects", "/messages", "/admin/rules", "/lead/new"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin$/);
  }
  expect((await request.get("/api/bills/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  expect((await request.get("/api/documents/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  expect((await request.get("/api/quotes/00000000-0000-4000-8000-000000000000/pdf")).status()).toBe(404);

  // a homeowner is bounced from sales pages
  await signIn(page, freshPhone());
  await page.waitForURL("/");
  for (const path of ["/leads", "/messages", "/admin/rules"]) {
    await page.goto(path);
    await expect(page).not.toHaveURL(new RegExp(`${path}$`));
  }
});

test("session cookie is httpOnly and SameSite=Lax; logout revokes server-side", async ({ page, context }) => {
  await signIn(page, freshPhone());
  await page.waitForURL("/");
  const cookie = (await context.cookies()).find((c) => c.name === "session")!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/signin$/);
  // replaying the old cookie must not work
  await context.addCookies([{ ...cookie }]);
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/signin$/);
});

test("accessibility of the core flow screens (quote story, bill review, tracker, sales desk)", async ({ browser }) => {
  test.setTimeout(180_000);
  const { createAcceptedProject, freshPhone: fp } = await import("./helpers");
  const { home, sales, projectId } = await createAcceptedProject(browser);
  await home.setViewportSize({ width: 360, height: 740 });
  await home.goto(`/projects/${projectId}`);
  await expect(home.getByText("Where we are")).toBeVisible();
  await audit(home, "project tracker (homeowner)"); await noHorizontalScroll(home);
  await home.goto("/");
  await home.getByRole("link", { name: /LD-/ }).first().click();
  await home.getByRole("link", { name: "Your solar quote" }).click();
  await expect(home.getByText("How we calculated this")).toBeVisible();
  await audit(home, "quote story (accepted)"); await noHorizontalScroll(home);

  // bill review screen (needs an unscored lead): start a lead and stop at review
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const p = await ctx.newPage();
  await signIn(p, fp());
  await p.waitForURL("/");
  await p.goto("/lead/new");
  await expect(async () => {
    await p.getByLabel("I own it").check(); await p.getByLabel("Flat concrete (RCC)").check();
    // force: Playwright's scroll-into-view fights a fixed bar in a short viewport; a real tap hits the button
    await p.getByRole("button", { name: "Continue" }).click({ force: true });
    await expect(p.getByText("Step 2 of 5")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await p.getByLabel("Roof area").fill("300"); await p.getByRole("button", { name: "Continue" }).click({ force: true });
  await p.getByLabel("Monthly electricity bill (₹)").fill("2900"); await p.getByLabel("Pincode").fill("440010"); await p.getByRole("button", { name: "Continue" }).click({ force: true });
  await p.getByLabel("Demo: use a sample bill").selectOption("bill-ambiguous.png"); await p.getByRole("button", { name: "Continue" }).click({ force: true });
  await p.getByLabel(/I agree that Company A/).check(); await p.getByRole("button", { name: "Get my estimate" }).click({ force: true });
  await expect(p.getByRole("heading", { name: "Check what we read" })).toBeVisible();
  await expect(p.getByText("Check this").first()).toBeVisible(); // unsure fields are flagged, not hidden
  await audit(p, "bill review (unsure fields)"); await noHorizontalScroll(p);
  await p.screenshot({ path: "e2e/shots/bill-review-unsure.png", fullPage: true });

  // sales desk at 1200px
  await sales.setViewportSize({ width: 1200, height: 900 });
  for (const path of ["/leads", "/projects", "/messages", "/admin/rules", `/projects/${projectId}`]) {
    await sales.goto(path);
    await audit(sales, `sales ${path}`);
  }
});
