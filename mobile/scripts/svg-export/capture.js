// Capture every Domtak screen as vector PDF (phone frame + full scroll length) from the web build.
// Usage: node capture.js <shots.json> <outDir> [baseUrl]
// Env: PLAYWRIGHT_MODULE (path to the playwright package, default: resolve 'playwright'),
//      CHROMIUM_PATH (browser binary, default: Playwright's bundled Chromium).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');

const [shotsFile, outDir, base = 'http://127.0.0.1:8099'] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
const W = 412;
const H = 892;

async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.images].filter((i) => !i.complete);
    await Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })));
  }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function extraScroll(page) {
  return page.evaluate(() => {
    let extra = 0;
    for (const el of document.querySelectorAll('div')) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.clientHeight > 200 && el.clientWidth > 300) {
        extra = Math.max(extra, el.scrollHeight - el.clientHeight);
      }
    }
    return extra;
  });
}

async function setRole(page, role) {
  await page.evaluate((r) => {
    const raw = localStorage.getItem('domtak-app');
    if (!raw) return;
    const data = JSON.parse(raw);
    data.state.user.role = r;
    localStorage.setItem('domtak-app', JSON.stringify(data));
  }, role);
}

const ACTIONS = {
  async click(page, a) {
    const loc = a.role ? page.getByRole(a.role, { name: a.name, exact: !!a.exact }) : page.getByText(a.text, { exact: !!a.exact });
    await loc.first().click({ timeout: 8000 });
    await page.waitForTimeout(a.wait ?? 700);
  },
  async fill(page, a) {
    const loc = a.placeholder ? page.getByPlaceholder(a.placeholder) : page.getByRole('textbox', { name: a.name });
    await loc.first().fill(a.value, { timeout: 8000 });
    await page.waitForTimeout(200);
  },
  async wait(page, a) {
    await page.waitForTimeout(a.ms);
  },
  async scroll(page, a) {
    await page.mouse.move(W / 2, H / 2);
    await page.mouse.wheel(0, a.y);
    await page.waitForTimeout(600);
  },
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${page.url()}: ${m.text().slice(0, 240)}`); });
  await page.emulateMedia({ media: 'screen' });

  const manifest = [];
  let loggedIn = false;
  let currentRole = 'fan';

  for (const shot of shots) {
    try {
      if (shot.fresh) {
        await page.goto(base + '/');
        await page.evaluate(() => localStorage.clear());
        loggedIn = false;
        currentRole = 'fan';
      } else if (!loggedIn) {
        await page.goto(base + '/');
        await page.evaluate(() => localStorage.clear());
        await page.goto(base + '/login');
        await settle(page, 600);
        await page.getByPlaceholder('Password').fill('secret123');
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.waitForTimeout(1500);
        loggedIn = true;
        currentRole = 'fan';
      }
      const role = shot.userRole ?? 'fan';
      if (loggedIn && role !== currentRole) {
        await setRole(page, role);
        currentRole = role;
      }
      await page.setViewportSize({ width: W, height: H });
      await page.goto(base + shot.path);
      await settle(page, 1200);
      for (const a of shot.actions ?? []) await ACTIONS[a.do](page, a);
      if (shot.actions?.length) await settle(page, 600);

      const phonePdf = `${outDir}/${shot.name}.pdf`;
      await page.pdf({ path: phonePdf, width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1' });
      const entry = { ...shot, phonePdf, fullPdf: null, fullHeight: H };

      if (!shot.noFull) {
        let extra = await extraScroll(page);
        if (extra > 24) {
          let h = H;
          for (let i = 0; i < 4 && extra > 4; i++) {
            h = Math.min(8000, h + extra);
            await page.setViewportSize({ width: W, height: h });
            await settle(page, 700);
            extra = await extraScroll(page);
          }
          const fullPdf = `${outDir}/${shot.name}--full.pdf`;
          await page.pdf({ path: fullPdf, width: `${W}px`, height: `${h}px`, printBackground: true, pageRanges: '1' });
          entry.fullPdf = fullPdf;
          entry.fullHeight = h;
          await page.setViewportSize({ width: W, height: H });
        }
      }
      manifest.push(entry);
      console.log('OK', shot.name, entry.fullHeight);
    } catch (e) {
      console.log('FAIL', shot.name, e.message.split('\n')[0]);
      manifest.push({ ...shot, error: e.message.split('\n')[0] });
    }
  }
  fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ manifest, errors }, null, 1));
  console.log('errors', JSON.stringify(errors.slice(0, 30), null, 1));
  await browser.close();
})();
