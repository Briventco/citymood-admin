// End-to-end smoke test of the newsroom against a running dev server.
// Usage: node docs/design/scripts/admin-smoke.mjs [baseUrl]
//
// As a Reporter (demo switcher): writes a story, waits for autosave, uploads a
// photo (resized in the browser), adds alt text, marks it Breaking and
// publishes. Then checks the homepage ticker shows it, that the reporter can't
// reach the Front page, and (as an Editor) pins it as the lead. Leaves the
// story in data/admin-dev.json; delete that file to reseed.

import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const headline = `Smoke test story ${new Date().toISOString().slice(11, 19)} (fake)`;
const browser = await chromium.launch();
let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed++;
};

async function as(role, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.goto(`${base}/admin/sign-in`);
  await page.getByRole('button', { name: role, exact: true }).click();
  await page.waitForURL(/\/admin\/articles/);
  return { context, page };
}

// ── Reporter writes and publishes ──
{
  const { context, page } = await as('Reporter');
  await page.goto(`${base}/admin/articles/new`);
  await page.locator('#headline').fill(headline);
  await page.locator('#category').selectOption({ label: 'Local News' });
  await page.locator('#standfirst').fill('A fake standfirst written by the smoke test.');
  await page.locator('.ProseMirror').click();
  await page.keyboard.type('Fake body text from the smoke test. Not CityMood reporting.');
  await page.locator('#standfirst').click(); // blur → autosave
  await page.waitForURL(/\/admin\/articles\/[0-9a-f-]{36}$/, { timeout: 15000 });
  check(/\/admin\/articles\/[0-9a-f-]{36}$/.test(page.url()), 'first save creates the draft and updates the URL');
  await page.getByText(/Saved (just now|\d+ minutes? ago)/).waitFor({ timeout: 15000 });
  check(true, 'autosave shows "Saved …"');

  check((await page.getByRole('switch', { name: 'Feature on homepage' }).count()) === 0, 'reporters do not see the Feature switch');

  await page.locator('input[type=file]:not([capture])').first().setInputFiles('public/seed/landscape-3.jpg');
  await page.locator('#image-alt').waitFor({ timeout: 20000 });
  check(true, 'photo uploads after resizing in the browser');

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  check(await page.getByText(/Before publishing, add: image alt text/).isVisible(), 'publishing is blocked until the photo has alt text');

  await page.locator('#image-alt').fill('A fake photo of a lagoon for the smoke test');
  await page.getByRole('switch', { name: 'Breaking news' }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByText('Published. It’s live on the site now.').waitFor({ timeout: 30000 }).catch(async (e) => {
    await page.screenshot({ path: 'docs/design/screenshots/admin/smoke-failure.png', fullPage: true });
    console.log('  alerts:', await page.getByRole('alert').allTextContents());
    throw e;
  });
  check(true, 'publishes');

  const home = await context.newPage();
  await home.goto(base + '/');
  check((await home.content()).includes(headline), 'the homepage shows the story (breaking ticker)');

  await page.goto(`${base}/admin/front-page`);
  check(await page.getByText('You don’t have access to this page').isVisible(), 'reporters get "no access" on the Front page');
  await context.close();
}

// ── Editor pins it as the lead ──
{
  const { context, page } = await as('Editor');
  await page.goto(`${base}/admin/front-page`);
  await page.getByRole('heading', { name: 'Front page', level: 1 }).waitFor({ timeout: 30000 });
  const lead = page.getByRole('region', { name: 'Lead story' });
  if (await lead.count()) {
    await lead.getByRole('button', { name: /Change|Pin a story/ }).click();
    await page.getByRole('dialog').getByRole('button').filter({ hasText: headline }).first().click();
    await page.waitForTimeout(1000);
    const home = await context.newPage();
    await home.goto(base + '/');
    const h1 = await home.locator('h1').first().textContent();
    check(h1?.includes(headline), 'the pinned lead is the homepage lead');
  } else {
    console.log('- front page not built yet, skipping the lead pin');
  }
  await context.close();
}

// ── Admin books a campaign; editors can't ──
{
  const { context, page } = await as('Admin');
  await page.goto(`${base}/admin/ads/new?slot=mpu_1`);
  await page.locator('#advertiser').fill('Fake Advertiser (smoke test)');
  await page.locator('#link').fill('https://example.com/');
  await page.locator('#ad-alt').fill('Fake advert for the smoke test');
  await page.locator('input[type=file]').first().setInputFiles('public/seed/landscape-4.jpg');
  await page.getByText(/different shape from 300×250/).waitFor({ timeout: 20000 });
  check(true, 'the campaign form warns when a creative is the wrong shape');
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await page.waitForURL(/\/admin\/ads$/, { timeout: 15000 });
  const home = await context.newPage();
  await home.goto(base + '/');
  check((await home.locator('a[rel~="sponsored"] img[alt="Fake advert for the smoke test"]').count()) > 0, 'the homepage shows the running campaign');
  await context.close();

  const editor = await as('Editor');
  await editor.page.goto(`${base}/admin/ads/new`);
  check(await editor.page.getByText('You don’t have access to this page').isVisible(), 'editors cannot open the campaign form');
  await editor.context.close();
}

// ── Admin invites and removes someone ──
{
  const email = `fake.${Date.now()}@demo.citymood.test`;
  const { context, page } = await as('Admin');
  await page.goto(`${base}/admin/staff`);
  await page.locator('#invite-name').fill('Fake Invitee');
  await page.locator('#invite-email').fill(email);
  await page.locator('#invite-role').selectOption('editor');
  await page.getByRole('button', { name: 'Send invite', exact: true }).click();
  await page.getByText(`Invite sent to ${email}.`).waitFor({ timeout: 10000 });
  const row = page.locator('tr', { hasText: email });
  check((await row.textContent())?.includes('Invited, not joined yet'), 'an invite shows as "Invited, not joined yet"');

  // The invitee signs in (demo store: any password).
  const invitee = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ip = await invitee.newPage();
  await ip.goto(`${base}/admin/sign-in`);
  await ip.locator('#email').fill(email);
  await ip.locator('#password').fill('any-password');
  await ip.getByRole('button', { name: 'Sign in', exact: true }).click();
  await ip.waitForURL(/\/admin\/articles/, { timeout: 10000 });
  check(true, 'the invitee can sign in');

  await row.getByRole('button', { name: /Edit/ }).click();
  await page.getByRole('button', { name: 'Remove from the newsroom' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await page.getByText('Fake Invitee can no longer sign in.').waitFor({ timeout: 10000 });
  // A fresh tab with the same session cookie.
  const again = await invitee.newPage();
  await again.goto(`${base}/admin/articles`);
  check(again.url().includes('/admin/sign-in'), 'a removed person is signed out at once');
  await invitee.close();
  await context.close();
}

// ── Admin: settings feed the footer; hiding a category removes it from the nav ──
{
  const { context, page } = await as('Admin');
  await page.goto(`${base}/admin/settings`);
  const phone = `+234 000 ${Math.floor(Math.random() * 9000 + 1000)} (fake)`;
  await page.locator('#newsroom_phone').fill(phone);
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.getByText(/^Saved\./).waitFor({ timeout: 10000 });
  const home = await context.newPage();
  await home.goto(base + '/');
  check((await home.locator('footer').textContent())?.includes(phone), 'site settings show in the public footer');

  await page.goto(`${base}/admin/taxonomy`);
  await page.getByRole('switch', { name: 'Show Culture & Events on the site' }).click();
  await page.getByText('Culture & Events is hidden.', { exact: false }).waitFor({ timeout: 10000 });
  await home.goto(base + '/');
  const nav = await home.locator('nav').first().textContent();
  check(!nav?.includes('Culture'), 'a hidden category leaves the public section nav');
  await page.getByRole('switch', { name: 'Show Culture & Events on the site' }).click();
  await page.getByText('Culture & Events is shown on the site.').waitFor({ timeout: 10000 });
  await context.close();
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
