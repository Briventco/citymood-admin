// CityMood visual + accessibility check.
// Usage:
//   npm i -D playwright @axe-core/playwright   (once)
//   npx playwright install chromium            (once, if no browser is installed)
//   node docs/design/scripts/visual-check.mjs http://localhost:3000/ [outDir]
//
// Saves full-page screenshots at 390, 768 and 1280px so they can be compared
// with docs/design/reference/*.png, and prints axe violations plus a few
// CityMood-specific checks (horizontal scroll, small tap targets, h1 count).

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:3000/';
const outDir = process.argv[3] || 'docs/design/screenshots';
const widths = [390, 768, 1280];

let AxeBuilder = null;
try { ({ default: AxeBuilder } = await import('@axe-core/playwright')); } catch { /* optional */ }

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(outDir, `homepage-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });

  const report = await page.evaluate(() => {
    const scroll = document.documentElement.scrollWidth > window.innerWidth;
    const h1s = document.querySelectorAll('h1').length;
    const small = [...document.querySelectorAll('a, button, input, select, [role="button"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || s.visibility === 'hidden') return false;
        const inline = s.display === 'inline' && el.closest('p, li');
        return !inline && (r.height < 44 && r.width < 44);
      })
      .slice(0, 10)
      .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40));
    return { scroll, h1s, small };
  });

  console.log(`\n=== ${width}px → ${file}`);
  if (report.scroll) { problems++; console.log('  ✗ horizontal scroll present'); }
  if (report.h1s !== 1) { problems++; console.log(`  ✗ expected 1 h1, found ${report.h1s}`); }
  if (report.small.length) console.log('  ! possible small tap targets:', report.small);

  if (AxeBuilder) {
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    problems += serious.length;
    for (const v of serious) console.log(`  ✗ axe ${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
    if (!serious.length) console.log('  ✓ axe: no serious/critical issues');
  } else {
    console.log('  (install @axe-core/playwright to include the accessibility audit)');
  }
  await context.close();
}

await browser.close();
console.log(`\nCompare ${outDir}/ with docs/design/reference/*.png.`);
process.exit(problems ? 1 : 0);
