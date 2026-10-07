// Builds the lab, opens every preset in headless Chromium, and fails on any
// console error or error banner; then runs the behavior checks. Screenshots
// land in shots/, two per preset (as loaded, and in the Part mode),
// overwritten each run.
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { bareHold, bareStill, bareView, equationsTab, exportSvg, hostileHash, importOutline, importPicture, modeToggles, resetKey, setMode, splitZoom } from './checks.mjs';

const PRESETS = ['swirl', 'basket', 'barleycorn', 'wheel', 'oval', 'barrel', 'dome', 'straight'];
const root = new URL('..', import.meta.url).pathname;

await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: 0, host: '127.0.0.1' } });
const url = server.resolvedUrls.local[0];
await mkdir(`${root}shots`, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
try {
  for (const [i, name] of PRESETS.entries()) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.selectOption('.rs-preset select', name);
    await page.waitForTimeout(1500);
    const banner = await page.locator('.rs-error').count();
    await page.screenshot({ path: `${root}shots/${name}.png` });
    await setMode(page, 'part');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${root}shots/${name}-part.png` });
    const ok = errors.length === 0 && banner === 0;
    if (!ok) failed++;
    console.log(`${i + 1}/${PRESETS.length} ${name}: ${ok ? 'ok' : `FAILED ${errors.join('; ') || 'error banner shown'}`}`);
    await page.close();
  }
  const checks = { hostileHash, modeToggles, splitZoom, bareView, bareHold, bareStill, exportSvg, resetKey, equationsTab, importOutline, importPicture };
  for (const [i, [name, check]] of Object.entries(checks).entries()) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
    const problem = await check(page, url);
    if (problem) failed++;
    console.log(`check ${i + 1}/${Object.keys(checks).length} ${name}: ${problem ? `FAILED ${problem}` : 'ok'}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
