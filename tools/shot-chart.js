/**
 * A second, narrower verification pass: force light mode and open a pattern
 * that actually has a knot chart, because the main run happens to land on a
 * style that does not.
 */
import { launch } from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE ?? 'http://127.0.0.1:8099/';
const OUT = new URL('./shots/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(OUT, { recursive: true });

const browser = await launch({ executablePath: EDGE, headless: 'new', args: ['--force-color-profile=srgb'] });
const errors = [];

async function run(scheme, prompt, prefix) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1500, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${prefix}: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`${prefix}: failed ${r.url()}`));

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.type('#prompt', prompt);
  await page.click('#go');
  await page.waitForSelector('.pcard', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));

  // Pick the first card that actually has a chart.
  const n = await page.$$eval('.pcard', (c) => c.length);
  let idx = -1;
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => document.querySelectorAll('.pcard')[k].click(), i);
    await new Promise((r) => setTimeout(r, 400));
    if (await page.$('[data-tab=chart]')) { idx = i; break; }
    await page.evaluate(() => document.querySelector('[data-act=close]')?.click());
    await new Promise((r) => setTimeout(r, 300));
  }
  if (idx < 0) { errors.push(`${prefix}: no card had a chart`); await page.close(); return; }

  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => document.querySelector('[data-tab=chart]').click());
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => document.querySelector('#detail').scrollIntoView());
  await page.screenshot({ path: `${OUT}${prefix}-chart.png` });

  await page.evaluate(() => document.querySelector('[data-tab=follow]').click());
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => { for (let i = 0; i < 8; i++) document.querySelector('[data-follow=next]').click(); });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}${prefix}-follow.png` });
  console.log(`  ${prefix}-chart.png, ${prefix}-follow.png`);
  await page.close();
}

console.log('light');
await run('light', 'sunset chevron in warm oranges', '30-light');
console.log('dark');
await run('dark', 'blue bracelet with the word LOVE written across', '31-dark');

await browser.close();
console.log(errors.length ? `\nPROBLEMS:\n${errors.join('\n')}` : '\nno console errors, no failed requests');
