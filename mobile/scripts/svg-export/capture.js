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

// Re-encode every photo at 2x its on-screen size (object-fit cover, centred) so the PDF/SVG
// carries only the pixels that are visible instead of the full source image for each thumbnail.
async function downscaleImages(page) {
  await page.evaluate(async () => {
    const jobs = [...document.images].map(async (img) => {
      const r = img.getBoundingClientRect();
      if (!img.complete || !img.naturalWidth || r.width < 1 || r.height < 1 || img.src.startsWith('data:')) return;
      const W = Math.round(r.width * 2);
      const H = Math.round(r.height * 2);
      if (img.naturalWidth <= W * 1.15 && img.naturalHeight <= H * 1.15) return;
      const cs = getComputedStyle(img);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const fit = cs.objectFit === 'contain' ? Math.min : Math.max;
      const scale = fit(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // Keep PNG only when the result really has transparency (e.g. contain-fit logos).
      const px = ctx.getImageData(0, 0, W, H).data;
      let png = false;
      for (let i = 3; i < px.length; i += 4 * 13) if (px[i] < 250) { png = true; break; }
      // Swap in a static copy: changing the src of the app-managed <img> would restart its fade-in.
      const copy = img.cloneNode(false);
      copy.removeAttribute('srcset');
      copy.style.objectFit = 'fill';
      copy.style.opacity = '1';
      copy.style.transition = 'none';
      copy.src = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86);
      await copy.decode().catch(() => {});
      img.style.display = 'none';
      img.after(copy);
    });
    await Promise.all(jobs);
  }).catch(() => {});
}

// Chrome shrinks the whole printout (up to 1.5x) when a horizontal scroller's content is wider than the
// page, e.g. the onboarding pager. Pinning each horizontal scroller to its on-screen box keeps 1:1 scale.
async function pinScrollers(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      // Only purely horizontal scrollers: pinning a vertical one would stop the full-length capture growing.
      if (cs.overflowX === 'visible' || el.scrollWidth <= el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) continue;
      const r = el.getBoundingClientRect();
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.contain = 'strict';
    }
  }).catch(() => {});
}

async function setRole(page, role) {
  await page.evaluate((r) => {
    const raw = localStorage.getItem('domtak-app');
    if (!raw) return;
    const data = JSON.parse(raw);
    data.state.user.role = r;
    // Professional screens need an approved role (blueprint F02); the demo approves it directly.
    const approved = new Set(data.state.user.approvedRoles || ['fan']);
    approved.add(r);
    data.state.user.approvedRoles = [...approved];
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
      if (loggedIn && shot.patch) {
        // Demo state a screen needs (e.g. admin console switch, a submitted application).
        await page.evaluate((patch) => {
          const raw = localStorage.getItem('domtak-app');
          if (!raw) return;
          const data = JSON.parse(raw);
          for (const [k, v] of Object.entries(patch)) data.state[k] = k === 'user' ? { ...data.state.user, ...v } : v;
          localStorage.setItem('domtak-app', JSON.stringify(data));
        }, shot.patch);
      }
      await page.setViewportSize({ width: W, height: H });
      await page.goto(base + shot.path);
      await settle(page, 1200);
      for (const a of shot.actions ?? []) await ACTIONS[a.do](page, a);
      if (shot.actions?.length) await settle(page, 600);

      await downscaleImages(page);
      await pinScrollers(page);
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
          await downscaleImages(page);
          await pinScrollers(page);
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
