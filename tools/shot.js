/**
 * tools/shot.js -- drive the real page in a real browser and take pictures.
 *
 * Not part of the app. It exists because "does it look right" is not something
 * you can assert in a unit test, and because a console error in the browser is
 * invisible from Node.
 *
 *   node tools/shot.js [url]
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const base = process.argv[2] ?? 'http://localhost:8099/';
const out = 'tools/shots';
mkdirSync(out, { recursive: true });

const problems = [];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'],
});

async function newPage(width = 1280, height = 1000, mobile = false) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  return page;
}

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: `${out}/${name}.png`, ...opts });
  console.log(`  ${name}.png`);
}

/* ---------------------------------------------------------------- desktop */
console.log('desktop');
const page = await newPage();
await page.goto(base, { waitUntil: 'networkidle0' });
await shot(page, '01-landing');

await page.type('#prompt', 'daisy chain with little watermelons between them');
await page.click('#go');
await page.waitForSelector('.pcard', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => document.querySelector('#results').scrollIntoView());
await shot(page, '02-cards');

await page.click('.pcard');
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => document.querySelector('#detail').scrollIntoView());
await shot(page, '03-overview');

const hasChart = await page.evaluate(() => !!document.querySelector('[data-tab=chart]'));
if (hasChart) {
  await page.evaluate(() => document.querySelector('[data-tab=chart]').click());
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, '04-chart');
} else {
  // Braid/spiral/macrame have no knot grid, so no Chart tab is expected.
  console.log('  (no chart tab for this style)');
}

await page.evaluate(() => document.querySelector('[data-tab=steps]').click());
await new Promise((r) => setTimeout(r, 400));
await shot(page, '05-steps');

await page.evaluate(() => document.querySelector('[data-tab=follow]').click());
await new Promise((r) => setTimeout(r, 400));
await shot(page, '06-follow');

await page.evaluate(() => { for (let i = 0; i < 6; i++) document.querySelector('[data-follow=next]').click(); });
await new Promise((r) => setTimeout(r, 300));
await shot(page, '07-follow-row');

await page.evaluate(() => document.querySelector('[data-open=keys]').click());
await new Promise((r) => setTimeout(r, 400));
await shot(page, '08-keys');

/* --------------------------------------------------------------- a second idea */
const page2 = await newPage();
await page2.goto(base, { waitUntil: 'networkidle0' });
await page2.type('#prompt', "blue bracelet with the word 'LOVE' written accross");
await page2.click('#go');
await page2.waitForSelector('.pcard', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 700));
await page2.evaluate(() => document.querySelector('#results').scrollIntoView());
await shot(page2, '09-love-cards');
await page2.evaluate(() => document.querySelector('#detail').scrollIntoView());
await shot(page2, '10-love-detail');

/* ----------------------------------------------------------------- mobile */
console.log('mobile');
const m = await newPage(390, 844, true);
await m.goto(base, { waitUntil: 'networkidle0' });
await shot(m, '20-m-landing');
await m.type('#prompt', 'repeating cactus symbols');
await m.click('#go');
await m.waitForSelector('.pcard', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));
await m.evaluate(() => document.querySelector('#results').scrollIntoView());
await shot(m, '21-m-cards');
await m.evaluate(() => document.querySelector('[data-tab=follow]').click());
await m.evaluate(() => document.querySelector('#detail').scrollIntoView());
await new Promise((r) => setTimeout(r, 400));
await shot(m, '22-m-follow');

await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} browser problem(s):`);
  for (const p of [...new Set(problems)]) console.log(`  ! ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nno console errors, no failed requests');
}
