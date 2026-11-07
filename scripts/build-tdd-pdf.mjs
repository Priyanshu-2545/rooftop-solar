// Builds docs/TDD.pdf from docs/TDD.md: Markdown -> HTML (marked) -> PDF (headless Chromium via Playwright).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";
import { chromium } from "@playwright/test";

const docs = path.resolve("docs");
const md = readFileSync(path.join(docs, "TDD.md"), "utf8");
const body = marked.parse(md, { gfm: true });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Technical Design Document</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 10.5pt/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1E2430; }
  h1 { font: 700 22pt/1.2 Georgia, serif; margin: 0 0 6pt; } h2 { font: 700 15pt/1.3 Georgia, serif; margin: 20pt 0 6pt; border-top: 1px solid #E3DCCB; padding-top: 10pt; }
  h3 { font-size: 11.5pt; } blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3px solid #C9741B; background: #FFFDF8; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; page-break-inside: auto; } tr { page-break-inside: avoid; }
  th, td { border: 1px solid #E3DCCB; padding: 4pt 6pt; vertical-align: top; text-align: left; } th { background: #F6F1E7; }
  code, pre { font: 8.5pt Menlo, monospace; background: #F6F1E7; } pre { padding: 8pt; white-space: pre-wrap; } code { padding: 0 2pt; }
  img { max-width: 100%; max-height: 330pt; } td img { width: 100%; }
  a { color: #1E2430; }
</style></head><body>${body}</body></html>`;
const out = path.join(docs, "_tdd.html");
writeFileSync(out, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(out).href, { waitUntil: "load" });
await page.pdf({ path: path.join(docs, "TDD.pdf"), format: "A4", printBackground: true, displayHeaderFooter: true,
  headerTemplate: "<span></span>", footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#5B6270"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" } });
await browser.close();
console.log("wrote docs/TDD.pdf");
