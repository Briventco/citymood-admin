// CityMood newsroom screenshots + accessibility check.
// Usage (dev server running, development build so the demo switcher exists):
//   node docs/design/scripts/admin-screenshots.mjs [baseUrl] [role] [only]
//   e.g. node docs/design/scripts/admin-screenshots.mjs http://localhost:3000 editor articles,front-page
//
// Signs in with the "Demo mode: sign in as" switcher, then saves full-page
// screenshots of each admin screen at 1440 and 390px to
// docs/design/screenshots/admin/ for comparison with docs/design/reference/admin/.
// Also runs axe (WCAG 2 A/AA) and the visual-check.mjs checks: horizontal
// scroll, exactly one h1, and tap targets under 44px.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const role = process.argv[3] || 'admin';
const only = process.argv[4] ? process.argv[4].split(',') : null;
const outDir = 'docs/design/screenshots/admin';
const widths = [1440, 390];

let AxeBuilder = null;
try { ({ default: AxeBuilder } = await import('@axe-core/playwright')); } catch { /* optional */ }

/** name → path. `:article` is replaced with the first editable story's id. */
const screens = [
  ['sign-in', '/admin/sign-in', { signedOut: true }],
  ['articles', '/admin/articles'],
  ['article-editor', '/admin/articles/:article'],
  ['article-new', '/admin/articles/new'],
  ['front-page', '/admin/front-page'],
  ['ads', '/admin/ads'],
  ['ad-campaign', '/admin/ads/new?slot=mpu_1'],
  ['staff', '/admin/staff'],
  ['media', '/admin/media'],
  ['taxonomy', '/admin/taxonomy'],
  ['settings', '/admin/settings'],
  ['preview', '/admin/preview/:article'],
].filter(([name]) => !only || only.includes(name));

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let problems = 0;

async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${base}/admin/sign-in`);
  await page.getByRole('button', { name: role[0].toUpperCase() + role.slice(1), exact: true }).click();
  await page.waitForURL(/\/admin\/articles/);
  // First story the role can edit.
  const href = await page
    .locator('a[href^="/admin/articles/"]:not([href$="/new"])')
    .first()
    .getAttribute('href', { timeout: 5000 })
    .catch(() => null);
  await page.close();
  return href ? href.split('/').pop() : null;
}

for (const width of widths) {
  const signedIn = await browser.newContext({ viewport: { width, height: 900 } });
  const signedOut = await browser.newContext({ viewport: { width, height: 900 } });
  const articleId = await signIn(signedIn);

  for (const [name, route, opts = {}] of screens) {
    const context = opts.signedOut ? signedOut : signedIn;
    const page = await context.newPage();
    const url = base + route.replace(':article', articleId ?? 'missing');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(outDir, `${name}-${role}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });

    const report = await page.evaluate(() => {
      const scroll = document.documentElement.scrollWidth > window.innerWidth;
      const h1s = document.querySelectorAll('h1').length;
      const small = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="switch"]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || s.visibility === 'hidden') return false;
          if (el.type === 'checkbox' || el.type === 'radio') return !el.closest('label');
          const inline = s.display === 'inline' && el.closest('p, li');
          return !inline && (r.height < 44 && r.width < 44);
        })
        .slice(0, 10)
        .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40));
      return { scroll, h1s, small };
    });

    console.log(`\n=== ${name} ${width}px → ${file}`);
    if (report.scroll) { problems++; console.log('  ✗ horizontal scroll present'); }
    if (report.h1s !== 1) { problems++; console.log(`  ✗ expected 1 h1, found ${report.h1s}`); }
    if (report.small.length) console.log('  ! possible small tap targets:', report.small);
    if (AxeBuilder) {
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      problems += serious.length;
      for (const v of serious) {
        console.log(`  ✗ axe ${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}`);
      }
      if (!serious.length) console.log('  ✓ axe: no serious/critical issues');
    }
    await page.close();
  }
  await signedIn.close();
  await signedOut.close();
}

await browser.close();
console.log(`\nCompare ${outDir}/ with docs/design/reference/admin/*.png.`);
process.exit(problems ? 1 : 0);
