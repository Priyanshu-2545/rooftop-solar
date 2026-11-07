import { expect, test } from "@playwright/test";
import { createAcceptedProject } from "./helpers";

test("sales moves a stage: message logged, public status link updates, revoke works", async ({ browser }) => {
  const { home, sales, projectId } = await createAcceptedProject(browser);

  // stuck projects are listed first (two are stuck in the seed data)
  await sales.goto("/projects");
  await expect(sales.getByRole("heading", { name: "Stuck projects" })).toBeVisible();
  await expect(sales.getByText("PJ-30881").first()).toBeVisible();
  await sales.screenshot({ path: "e2e/shots/projects-stuck.png", fullPage: true });

  // sales creates the customer status link (shown once)
  await sales.goto(`/projects/${projectId}`);
  await sales.getByRole("button", { name: "Create link" }).click();
  const link = (await sales.getByText(/\/status\//).first().textContent())!.match(/https?:\/\/\S+\/status\/[\w-]+/)![0];

  // anonymous visitor sees the current stage
  const anon = await browser.newContext({ viewport: { width: 393, height: 851 } });
  const pub = await anon.newPage();
  await pub.goto(link);
  await expect(pub.getByText("Hello Asha")).toBeVisible();
  await expect(pub.getByText("Advance received").first()).toBeVisible();

  // sales moves the project forward with a note
  await sales.getByLabel("Move to").selectOption("survey_done");
  await sales.getByLabel("Note (optional)").fill("Roof is fine, 3 kW fits");
  await sales.getByRole("button", { name: "Move stage and message customer" }).click();
  await expect(sales.getByText(/Message sent \(demo/)).toBeVisible(); // visible feedback + message preview
  await expect(sales.getByText(/Survey done/).first()).toBeVisible();

  // message log shows it
  await sales.goto("/messages");
  await expect(sales.getByText(/your solar project is now: Survey done/).first()).toBeVisible();

  // public page now shows the new stage, with no personal data
  await pub.reload();
  await expect(pub.getByText("Survey done").first()).toBeVisible();
  const html = await pub.content();
  expect(html).toContain('name="robots" content="noindex');
  const visible = await pub.locator("body").innerText();
  expect(visible).not.toMatch(/\+91\s?\d{6}|consumer number|Wankhede/i);
  await pub.screenshot({ path: "e2e/shots/status-public.png", fullPage: true });

  // homeowner sees their own timeline
  await home.goto(`/projects/${projectId}`);
  await expect(home.getByText("Survey done").first()).toBeVisible();

  // revoke: the link stops working
  await sales.goto(`/projects/${projectId}`);
  await sales.getByRole("button", { name: "Revoke" }).click();
  await expect(sales.getByText("Link revoked.")).toBeVisible();
  await pub.reload();
  await expect(pub.getByText(/no longer active/)).toBeVisible();
});

test("demo status link from the seed works, and an unknown token reveals nothing", async ({ page }) => {
  await page.goto("/status/demo-status-prashant-4f9c2a7e5b1d4c68a0e2f7b9d3c1a5e8");
  await expect(page.getByText("Hello Prashant")).toBeVisible();
  await page.goto("/status/not-a-real-token-not-a-real-token-123");
  await expect(page.getByText(/no longer active/)).toBeVisible();
  await expect(page.getByText("Prashant")).toHaveCount(0);
});
