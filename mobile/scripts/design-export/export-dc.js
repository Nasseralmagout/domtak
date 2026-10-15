// Export every Domtak screen from the web build as two editable Design artboards (.dc.html):
//   <name>.final.dc.html      the V1 design: exact layout, colours, type and icons; photos become placeholders
//   <name>.wireframe.dc.html  the base wireframe: same layout in greyscale, photos as crossed boxes
// Usage: node export-dc.js <shots.json> <outDir> [baseUrl]
// Env: PLAYWRIGHT_MODULE, CHROMIUM_PATH (as for ../svg-export/capture.js).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');

const [shotsFile, outDir, base = 'http://127.0.0.1:8099'] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
const W = 412;
const H = 892;

async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
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
};

// Runs in the page: turns the rendered screen into a tree of positioned nodes with their visual styles.
function serializeScreen() {
  const FAMILIES = { DMSans: 'DM Sans', Poppins: 'Poppins', LilitaOne: 'Lilita One' };
  const font = (ff) => {
    const first = ff.split(',')[0].trim().replace(/["']/g, '');
    const m = first.match(/^([A-Za-z]+)_(\d{3})/);
    if (m) return { family: FAMILIES[m[1]] || m[1], weight: Number(m[2]) };
    return { family: FAMILIES[first] || first, weight: null };
  };
  const transparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const textStyle = (cs) => {
    const f = font(cs.fontFamily);
    const st = {
      'font-family': f.family,
      'font-weight': f.weight || cs.fontWeight,
      'font-size': cs.fontSize,
      'line-height': cs.lineHeight,
      color: cs.color,
    };
    if (cs.letterSpacing !== 'normal' && cs.letterSpacing !== '0px') st['letter-spacing'] = cs.letterSpacing;
    if (cs.textTransform !== 'none') st['text-transform'] = cs.textTransform;
    if (cs.textDecorationLine && cs.textDecorationLine !== 'none') st['text-decoration'] = cs.textDecorationLine;
    if (cs.fontStyle === 'italic') st['font-style'] = 'italic';
    return st;
  };
  const boxStyle = (cs, clips) => {
    const st = {};
    if (!transparent(cs.backgroundColor)) st['background-color'] = cs.backgroundColor;
    if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.includes('url(')) st['background-image'] = cs.backgroundImage;
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const w = parseFloat(cs[`border${side}Width`]);
      if (w > 0 && cs[`border${side}Style`] !== 'none' && !transparent(cs[`border${side}Color`])) st[`border-${side.toLowerCase()}`] = `${px(w)}px ${cs[`border${side}Style`]} ${cs[`border${side}Color`]}`;
    }
    const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
    if (radii.some((r) => parseFloat(r) > 0)) st['border-radius'] = radii.map((r) => `${px(r)}px`).join(' ');
    if (cs.boxShadow && cs.boxShadow !== 'none') st['box-shadow'] = cs.boxShadow;
    if (parseFloat(cs.opacity) < 1) st.opacity = cs.opacity;
    if (clips) st.overflow = 'hidden';
    return st;
  };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{\{/g, '{&#8203;{');
  const styleStr = (st) => Object.entries(st).map(([k, v]) => `${k}: ${String(v).replace(/"/g, "'")}`).join('; ');
  const visible = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01;

  const cleanSvg = (svg, w, h) => {
    const c = svg.cloneNode(true);
    c.removeAttribute('class');
    c.removeAttribute('style');
    c.setAttribute('width', String(px(w)));
    c.setAttribute('height', String(px(h)));
    c.setAttribute('aria-hidden', 'true');
    for (const n of c.querySelectorAll('*')) { n.removeAttribute('class'); n.removeAttribute('style'); }
    return c.outerHTML;
  };

  // Inline content of a text block: text nodes plus nested spans carrying only what differs.
  const inline = (el, parentCs) => {
    let html = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) html += esc(n.textContent);
      else if (n.nodeType === 1) {
        const cs = getComputedStyle(n);
        if (!visible(n, cs)) continue;
        if (n.tagName.toLowerCase() === 'svg') {
          const r = n.getBoundingClientRect();
          html += `<span style="display: inline-block; vertical-align: middle">${cleanSvg(n, r.width, r.height)}</span>`;
          continue;
        }
        const mine = textStyle(cs);
        const theirs = textStyle(parentCs);
        const diff = Object.fromEntries(Object.entries(mine).filter(([k, v]) => String(theirs[k]) !== String(v)));
        if (!transparent(cs.backgroundColor)) diff['background-color'] = cs.backgroundColor;
        const inner = inline(n, cs);
        html += Object.keys(diff).length ? `<span style="${styleStr(diff)}">${inner}</span>` : inner;
      }
    }
    return html;
  };

  // The whole body: modals and sheets render in portals next to #root.
  const root = document.body;
  const rootRect = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const bodyBg = getComputedStyle(document.body).backgroundColor;

  const walk = (el, parent, clip) => {
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) return;
    const r = el.getBoundingClientRect();
    const abs = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    const outside = clip && (abs.x >= clip.x + clip.w || abs.y >= clip.y + clip.h || abs.x + abs.w <= clip.x || abs.y + abs.h <= clip.y);
    const tag = el.tagName.toLowerCase();
    const rel = (node) => Object.assign(node, { x: px(abs.x - parent.abs.x), y: px(abs.y - parent.abs.y), w: px(abs.w), h: px(abs.h), abs });

    if (tag === 'svg') {
      if (!outside && abs.w > 0 && abs.h > 0) parent.c.push(rel({ t: 'svg', html: cleanSvg(el, abs.w, abs.h), big: abs.w > 80 && abs.h > 80 }));
      return;
    }
    if (tag === 'img') {
      const key = ((el.currentSrc || el.src || '').split('/').pop() || '').split('.')[0];
      if (!outside && abs.w > 1 && abs.h > 1) parent.c.push(rel({ t: 'img', s: boxStyle(cs, false), key, fit: cs.objectFit }));
      return;
    }
    if (tag === 'input' || tag === 'textarea') {
      if (outside) return;
      const value = el.value || '';
      const ph = el.getAttribute('placeholder') || '';
      const isPh = !value;
      const st = { ...textStyle(cs), ...boxStyle(cs, false) };
      st.padding = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`;
      if (isPh) st.color = 'rgb(154, 147, 176)';
      if (el.type === 'password' && value) st['letter-spacing'] = '2px';
      const text = el.type === 'password' && value ? '•'.repeat(value.length) : value || ph;
      parent.c.push(rel({ t: 'text', s: { ...st, 'white-space': tag === 'textarea' ? 'pre-wrap' : 'nowrap', overflow: 'hidden', display: 'flex', 'align-items': tag === 'textarea' ? 'flex-start' : 'center' }, html: esc(text), placeholder: isPh }));
      return;
    }

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const clips = cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    if (hasText) {
      if (outside) return;
      const st = { ...textStyle(cs), ...boxStyle(cs, false) };
      st['text-align'] = cs.textAlign === 'start' ? 'left' : cs.textAlign;
      const pads = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
      if (pads.some((p) => parseFloat(p) > 0)) st.padding = pads.join(' ');
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none' ? cs.webkitLineClamp : null;
      if (clamp) Object.assign(st, { display: '-webkit-box', '-webkit-box-orient': 'vertical', '-webkit-line-clamp': clamp, overflow: 'hidden' });
      else if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') Object.assign(st, { 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': cs.textOverflow === 'ellipsis' ? 'ellipsis' : 'clip' });
      else st['white-space'] = 'pre-wrap';
      parent.c.push(rel({ t: 'text', s: st, html: inline(el, cs) }));
      return;
    }

    const box = boxStyle(cs, clips);
    const drawn = Object.keys(box).length > 0 && abs.w > 0 && abs.h > 0;
    let next = parent;
    if (drawn) {
      if (outside) return;
      const node = rel({ t: 'box', s: box, c: [] });
      if (cs.zIndex !== 'auto' && cs.position !== 'static') node.s['z-index'] = cs.zIndex;
      parent.c.push(node);
      next = node;
    }
    const nextClip = clips && abs.w > 0 && abs.h > 0 ? abs : clip;
    for (const child of el.children) walk(child, next, nextClip);
  };

  const top = { abs: rootRect, c: [] };
  walk(root, top, rootRect);
  return { w: Math.round(window.innerWidth), h: Math.round(Math.max(window.innerHeight, document.documentElement.scrollHeight)), bg: bodyBg, nodes: top.c };
}

// ---------- HTML writers ----------
const style = (st) => Object.entries(st).map(([k, v]) => `${k}: ${v}`).join('; ');
const IMG_ICON = 'M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z';

function luminance(c) {
  const m = String(c).match(/rgba?\(([^)]+)\)/);
  if (!m) return { l: 255, a: 1 };
  const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
  return { l: 0.299 * r + 0.587 * g + 0.114 * b, a };
}
const grey = (v, a = 1) => {
  const n = Math.max(0, Math.min(255, Math.round(v)));
  return a < 1 ? `rgba(${n}, ${n}, ${n}, ${a})` : `rgb(${n}, ${n}, ${n})`;
};

function toWire(st, kind) {
  const out = {};
  for (const [k, v] of Object.entries(st)) {
    if (k === 'box-shadow') continue;
    if (k === 'background-image') continue;
    if (k === 'background-color') {
      const { l, a } = luminance(v);
      out[k] = grey(255 - (255 - l) * 0.45, a);
    } else if (k.startsWith('border-') && k !== 'border-radius') {
      out[k] = String(v).replace(/rgba?\([^)]+\)/, 'rgb(176, 176, 176)');
    } else if (k === 'color') {
      const { l } = luminance(v);
      out[k] = kind === 'placeholder' ? 'rgb(150, 150, 150)' : l < 150 ? 'rgb(43, 43, 43)' : 'rgb(255, 255, 255)';
    } else if (k === 'font-family') {
      out[k] = 'DM Sans';
    } else out[k] = v;
  }
  if (st['box-shadow'] && !Object.keys(st).some((k) => k.startsWith('border-') && k !== 'border-radius')) out.border = '1px solid rgb(208, 208, 208)';
  return out;
}

function placeholder(n, wire) {
  const big = n.w * n.h > 30000;
  const icon = Math.max(12, Math.min(44, Math.min(n.w, n.h) * 0.3));
  const radius = n.s['border-radius'] ? `; border-radius: ${n.s['border-radius']}` : '';
  if (wire) {
    const bg = big ? 'rgb(150, 150, 150)' : 'rgb(214, 214, 214)';
    const line = big ? 'rgb(128, 128, 128)' : 'rgb(184, 184, 184)';
    return `<div style="position: absolute; left: ${n.x}px; top: ${n.y}px; width: ${n.w}px; height: ${n.h}px; background-color: ${bg}; overflow: hidden${radius}"><svg width="${n.w}" height="${n.h}" aria-hidden="true" style="display: block"><line x1="0" y1="0" x2="${n.w}" y2="${n.h}" stroke="${line}" stroke-width="1"></line><line x1="${n.w}" y1="0" x2="0" y2="${n.h}" stroke="${line}" stroke-width="1"></line></svg></div>`;
  }
  const bg = big ? 'rgb(47, 35, 80)' : 'rgb(218, 212, 234)';
  const fg = big ? 'rgb(122, 108, 168)' : 'rgb(155, 144, 189)';
  return `<div style="position: absolute; left: ${n.x}px; top: ${n.y}px; width: ${n.w}px; height: ${n.h}px; background-color: ${bg}; display: flex; align-items: center; justify-content: center; overflow: hidden${radius}"><svg width="${px2(icon)}" height="${px2(icon)}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IMG_ICON}" fill="${fg}"></path></svg></div>`;
}
const px2 = (v) => Math.round(v * 10) / 10;
// Brand artwork (not photos) stays in the final design; the canvas build swaps ASSET:<key> for the uploaded file.
const ARTWORK = new Set(['logo', 'ill_onboard1', 'ill_onboard2', 'ill_onboard3']);

function render(nodes, wire) {
  let html = '';
  for (const n of nodes) {
    const pos = { position: 'absolute', left: `${n.x}px`, top: `${n.y}px`, width: `${n.w}px`, height: `${n.h}px`, 'box-sizing': 'border-box' };
    if (n.t === 'img' && !wire && ARTWORK.has(n.key)) html += `<img src="ASSET:${n.key}" alt="" style="${style({ ...pos, 'object-fit': n.fit || 'contain' })}">`;
    else if (n.t === 'img') html += placeholder(n, wire);
    else if (n.t === 'svg') {
      let svg = n.html;
      if (wire) svg = n.big ? null : svg.replace(/fill="(?!none)[^"]*"/g, 'fill="rgb(110, 110, 110)"').replace(/stroke="(?!none)[^"]*"/g, 'stroke="rgb(110, 110, 110)"');
      if (svg === null) html += placeholder({ ...n, s: {} }, true);
      else html += `<div style="${style(pos)}">${svg}</div>`;
    } else if (n.t === 'text') {
      const st = wire ? toWire(n.s, n.placeholder ? 'placeholder' : 'text') : n.s;
      let inner = n.html;
      if (wire) inner = inner.replace(/color: rgba?\([^)]*\)/g, (m) => (luminance(m.slice(7)).l < 150 ? 'color: rgb(43, 43, 43)' : 'color: rgb(255, 255, 255)')).replace(/font-family: [^;"]+/g, 'font-family: DM Sans').replace(/fill="(?!none)[^"]*"/g, 'fill="rgb(110, 110, 110)"').replace(/background-color: rgba?\([^)]*\)/g, 'background-color: rgb(230, 230, 230)');
      html += `<div style="${style({ ...pos, width: `${px2(n.w + 1)}px`, ...st })}">${inner}</div>`;
    } else {
      const st = wire ? toWire(n.s, 'box') : n.s;
      html += `<div style="${style({ ...pos, ...st })}">${render(n.c, wire)}</div>`;
    }
  }
  return html;
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&amp;family=Lilita+One&amp;family=Poppins:wght@400;500;600;700&amp;display=swap" rel="stylesheet">';
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function artboard(title, tree, wire) {
  const bg = wire ? 'rgb(255, 255, 255)' : tree.bg && !/rgba\([^)]*,\s*0\)/.test(tree.bg) ? tree.bg : 'rgb(248, 247, 251)';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escAttr(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
<style>
body{margin:0}
</style>
</helmet>
<div style="position: relative; width: ${tree.w}px; height: ${tree.h}px; overflow: hidden; background-color: ${bg}; font-family: 'DM Sans', sans-serif">
${render(tree.nodes, wire)}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${tree.w},"height":${tree.h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
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
      let h = H;
      if (!shot.noFull) {
        let extra = await extraScroll(page);
        for (let i = 0; i < 4 && extra > 24; i++) {
          h = Math.min(8000, h + extra);
          await page.setViewportSize({ width: W, height: h });
          await settle(page, 700);
          extra = await extraScroll(page);
        }
      }
      const tree = await page.evaluate(serializeScreen);
      tree.h = h;
      fs.writeFileSync(`${outDir}/${shot.name}.final.dc.html`, artboard(shot.title, tree, false));
      fs.writeFileSync(`${outDir}/${shot.name}.wireframe.dc.html`, artboard(`${shot.title} (wireframe)`, tree, true));
      manifest.push({ name: shot.name, title: shot.title, section: shot.section, w: tree.w, h });
      console.log('OK', shot.name, h);
    } catch (e) {
      console.log('FAIL', shot.name, e.message.split('\n')[0]);
    }
  }
  fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 1));
  await browser.close();
})();
