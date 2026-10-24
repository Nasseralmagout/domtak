// Builds docs/Domtak-Technical-Handbook.pdf from the HTML parts in docs/handbook/parts.
// Usage (from the repository root, after `npm ci` in mobile/ so the brand fonts exist):
//   node docs/handbook/build.mjs
// Needs Playwright with Chromium (PLAYWRIGHT_MODULE / CHROMIUM_PATH can point to existing installs)
// and Python 3 with pypdf and pdfplumber (contents page numbers and the final merge).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'Domtak-Technical-Handbook.pdf');
const work = path.join(here, '.build');
fs.mkdirSync(work, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const parts = fs.readdirSync(path.join(here, 'parts')).filter((f) => f.endsWith('.html')).sort();
const source = parts.map((f) => fs.readFileSync(path.join(here, 'parts', f), 'utf8')).join('\n');

const coverMatch = source.match(/<section class="cover">[\s\S]*?<\/section>/);
const head = source.slice(0, source.indexOf('<body>') + '<body>'.length);
const body = source.replace(coverMatch[0], '');

// Number the headings and leave an invisible marker in each, so the PDF text tells us its page.
const toc = [];
let n = 0;
const marked = body.replace(/<h([12])(?![^>]*data-notoc)([^>]*)>([\s\S]*?)<\/h\1>/g, (_, level, attrs, text) => {
  const id = `h${++n}`;
  toc.push({ id, level: Number(level), text: text.replace(/<[^>]+>/g, '').trim() });
  return `<h${level}${attrs} id="${id}">${text}<span class="mk">QQ${id}QQ</span></h${level}>`;
});

const pagesFile = path.join(work, 'pages.json');
const markerCss = '<style>.mk{position:absolute;font-size:1pt;color:#fff;margin-left:2mm}h1,h2{position:relative}</style>';

function tocHtml(pages) {
  const items = toc
    .map((t) => `<li class="l${t.level}"><a href="#${t.id}">${t.text}</a><span class="dots"></span><span class="pg">${pages?.[t.id] ?? ''}</span></li>`)
    .join('\n');
  return `<ol>${items}</ol>`;
}

async function render(pages) {
  const bodyHtml = marked.replace('<!--TOC-->', tocHtml(pages)).replace('</head>', `${markerCss}</head>`);
  const coverHtml = `${head}\n${coverMatch[0]}\n</body></html>`;
  fs.writeFileSync(path.join(here, 'body.html'), bodyHtml);
  fs.writeFileSync(path.join(here, 'cover.html'), coverHtml);

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const footer = `<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#6B6580;padding:0 18mm;display:flex;justify-content:space-between">
    <span>Domtak V1 · Technical Handbook · Version 1.0</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  const header = `<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#9C95B3;padding:0 18mm;text-align:right">Android · iOS · Web</div>`;

  await page.goto(pathToFileURL(path.join(here, 'body.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(work, 'body.pdf'),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: header,
    footerTemplate: footer,
    margin: { top: '22mm', bottom: '20mm', left: '18mm', right: '18mm' },
  });

  await page.goto(pathToFileURL(path.join(here, 'cover.html')).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(work, 'cover.pdf'), format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' }, pageRanges: '1' });
  await browser.close();
}

const py = path.join(here, 'pdftools.py');
// Pass 1 finds the pages; pass 2 prints them in the contents. Repeat once if the contents changed length.
let pages;
for (let pass = 0; pass < 3; pass++) {
  await render(pages);
  const found = JSON.parse(execFileSync('python3', ['-I', py, 'pages', path.join(work, 'body.pdf')], { encoding: 'utf8' }));
  const same = pages && toc.every((t) => pages[t.id] === found[t.id]);
  pages = found;
  if (same) break;
}
execFileSync('python3', ['-I', py, 'merge', path.join(work, 'cover.pdf'), path.join(work, 'body.pdf'), out], { stdio: 'inherit' });
const missing = toc.filter((t) => !pages[t.id]).map((t) => t.text);
if (missing.length) console.warn('Headings without a page:', missing);
console.log(`Wrote ${out}`);
