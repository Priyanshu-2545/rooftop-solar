import { expect, test } from "@playwright/test";
import { freshPhone, submitConfirmedLead, signIn } from "./helpers";

test("sales builds and sends a quote; homeowner sees the story and accepts (mock pay); project appears", async ({ browser }) => {
  const phone = freshPhone();
  const homeCtx = await browser.newContext({ viewport: { width: 393, height: 851 } });
  const home = await homeCtx.newPage();
  const leadId = await submitConfirmedLead(home, phone);

  // Sales opens the lead and builds a quote
  const salesCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const sales = await salesCtx.newPage();
  await signIn(sales, "9000000001");
  await sales.waitForURL("/leads");
  await sales.goto(`/leads/${leadId}`);
  await expect(sales.getByText("Strong bill and roof fit")).toBeVisible();
  await sales.getByRole("link", { name: "Start quote" }).click();
  await expect(sales.getByRole("heading", { name: /Quote for LD-/ })).toBeVisible();
  // live numbers for the sample: 3 kW => ₹1,65,000 - ₹78,000 = ₹87,000
  await expect(sales.getByText("₹87,000").first()).toBeVisible();
  await expect(sales.getByText("What the homeowner sees")).toBeVisible();
  await sales.screenshot({ path: "e2e/shots/quote-builder.png", fullPage: true });
  await sales.getByRole("button", { name: "Send quote" }).click();
  await expect(sales.getByText(/Preview as the homeowner sees it/)).toBeVisible();

  // Homeowner: quote story first, details behind a disclosure, accept last
  await home.goto(`/leads/${leadId}`);
  await home.getByRole("link", { name: "Your solar quote" }).click();
  await expect(home.getByText("You pay after subsidy").first()).toBeVisible();
  await expect(home.getByText("₹87,000").first()).toBeVisible();
  await expect(home.getByText("Pays back in").first()).toBeVisible();
  await home.screenshot({ path: "e2e/shots/quote-story.png", fullPage: true });
  await home.getByText("How we calculated this").click();
  await expect(home.getByText("Government subsidy")).toBeVisible();
  await home.getByRole("button", { name: "Accept and pay advance" }).click();
  await expect(home.getByText("Thank you. Your solar project has started.")).toBeVisible();
  await expect(home.getByRole("link", { name: "See my project" })).toBeVisible();
  await home.screenshot({ path: "e2e/shots/quote-accepted.png", fullPage: true });

  // PDF is served only to authorised users and is a real PDF
  const pdf = await homeCtx.request.get(`/api/quotes/${(home.url().split("/quotes/")[1] ?? "").split("?")[0]}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const qid = (home.url().split("/quotes/")[1] ?? "").split("?")[0];
  const fs = await import("node:fs");
  fs.writeFileSync("e2e/shots/quote-en.pdf", await pdf.body());
  fs.writeFileSync("e2e/shots/quote-mr.pdf", await (await homeCtx.request.get(`/api/quotes/${qid}/pdf?lang=mr`)).body());

  // another homeowner can never fetch this quote or its PDF (IDOR)
  const otherCtx = await browser.newContext();
  const other = await otherCtx.newPage();
  await signIn(other, freshPhone());
  await other.waitForURL("/");
  expect((await otherCtx.request.get(`/api/quotes/${qid}/pdf`)).status()).toBe(404);
  expect((await other.goto(`/quotes/${qid}`))?.status()).toBe(404);
});
