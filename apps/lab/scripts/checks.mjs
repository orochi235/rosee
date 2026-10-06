// Behaviors the presets alone don't exercise. Each takes a fresh page on the
// lab's URL and returns '' when it holds, or what went wrong.

const hash = (v) => `#s=${Buffer.from(JSON.stringify(v)).toString('base64url')}`;

async function setMode(page, mode) {
  await page.getByRole('button', { name: 'Output' }).click();
  await page.getByRole('option', { name: mode, exact: true }).click();
}

/** A hash from an older or hand-edited lab still draws every tile. */
export async function hostileHash(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + hash({ preset: 'constructor', settings: { rosette: {}, rubber: {}, job: {}, cutter: {} }, look: { metal: 'x' } }));
  await page.waitForTimeout(1500);
  const tiles = await page.locator('.rs-tile').count();
  return errors.length ? errors.join('; ') : tiles === 4 ? '' : `${tiles} tiles drawn`;
}

/** Switching the output mode back and forth reuses one WebGL context. */
export async function modeToggles(page, url) {
  await page.addInitScript(() => {
    const seen = new Set();
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      const c = get.call(this, kind, ...rest);
      if (kind === 'webgl2' && c) seen.add(c);
      window.__contexts = seen.size;
      return c;
    };
  });
  await page.goto(url);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.__contexts);
  for (let k = 0; k < 5; k++) {
    for (const mode of ['lines', 'split', 'surface']) {
      await setMode(page, mode);
      await page.waitForTimeout(100);
    }
  }
  const after = await page.evaluate(() => window.__contexts);
  return after === before ? '' : `WebGL contexts grew from ${before} to ${after}`;
}

/** In split mode the wheel zooms about the point under the cursor, and a
 *  burst of wheel events lands in full. The cutter's amber dot on the lines
 *  pane is the landmark. */
export async function splitZoom(page, url) {
  await page.goto(url);
  await setMode(page, 'split');
  await page.waitForTimeout(1500);
  const dot = () =>
    page.evaluate(() => {
      const c = document.querySelector('.rs-output > canvas');
      const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let i = 0; i < width * height; i++) {
        const [r, g, b] = data.subarray(i * 4, i * 4 + 3);
        if (Math.abs(r - 232) < 6 && Math.abs(g - 163) < 6 && Math.abs(b - 61) < 6) {
          sx += i % width;
          sy += Math.floor(i / width);
          n++;
        }
      }
      const rect = c.getBoundingClientRect();
      const k = c.width / rect.width;
      return n ? [rect.left + sx / n / k, rect.top + sy / n / k] : null;
    });
  const d0 = await dot();
  if (!d0) return 'no cutter dot on the lines pane';
  await page.mouse.move(d0[0], d0[1]);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(300);
  const d1 = await dot();
  if (!d1) return 'one wheel step zoomed the point under the cursor out of the pane';
  const drift = Math.hypot(d1[0] - d0[0], d1[1] - d0[1]);
  if (drift > 4) return `the point under the cursor drifted ${drift.toFixed(1)} px`;
  // Five steps of ×e^0.15 from 40 px away push the dot to 40·e^0.75 px.
  const cursor = [d1[0], d1[1] - 40];
  await page.evaluate(([x, y]) => {
    const c = document.querySelector('.rs-output > canvas');
    for (let k = 0; k < 5; k++) c.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: x, clientY: y, bubbles: true }));
  }, cursor);
  await page.waitForTimeout(300);
  const d2 = await dot();
  const off = d2 ? d2[1] - cursor[1] : Number.NaN;
  return Math.abs(off - 40 * Math.exp(0.75)) < 5 ? '' : `a burst of five wheel steps left the dot ${off.toFixed(1)} px off, not 84.7`;
}

/** `?bare` draws the surface alone in a tile-sized frame and adds the machine
 *  once the frame is wide, with no lab chrome either way. */
export async function bareView(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const bare = `${url}?bare`;
  await page.setViewportSize({ width: 560, height: 315 });
  await page.goto(bare);
  await page.waitForTimeout(1500);
  const narrow = await page.locator('.rs-bare canvas').count();
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.waitForTimeout(800);
  const wide = await page.locator('.rs-bare canvas').count();
  const chrome = await page.locator('.rs-sidebar, .rs-transport, .rs-parts').count();
  if (errors.length) return errors.join('; ');
  if (chrome) return 'lab chrome drawn in the bare view';
  return narrow === 1 && wide === 2 ? '' : `${narrow} canvases narrow, ${wide} wide`;
}

/** `?bare=cut` stays the surface alone however wide the frame. */
export async function bareCut(page, url) {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto(`${url}?bare=cut`);
  await page.waitForTimeout(1500);
  const n = await page.locator('.rs-bare canvas').count();
  return n === 1 ? '' : `${n} canvases`;
}
