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

/** `?bare` draws the lines alone in a tile-sized frame and adds the machine
 *  once the frame is wide, over a transparent page with no lab chrome. */
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
  // An opaque root, or a color scheme unlike the embedder's, hides the page behind the frame.
  const [ground, scheme] = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return [root.backgroundColor, root.colorScheme];
  });
  if (errors.length) return errors.join('; ');
  if (ground !== 'rgba(0, 0, 0, 0)' || scheme !== 'normal') return `root is ${ground}, color-scheme ${scheme}`;
  // The callouts set their own ink; inherited, it is black on their dark box.
  const canvas = await page.locator('.rs-stage canvas').boundingBox();
  for (let y = 0.1; y < 0.9 && !(await page.locator('.rs-callout').count()); y += 0.05) {
    await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * y);
    await page.waitForTimeout(60);
  }
  const ink = await page.locator('.rs-callout p').first().evaluate((e) => getComputedStyle(e).color).catch(() => null);
  if (ink === null) return 'no callout under the machine';
  if (ink === 'rgb(0, 0, 0)') return 'callout text is black';
  if (chrome) return 'lab chrome drawn in the bare view';
  return narrow === 1 && wide === 2 ? '' : `${narrow} canvases narrow, ${wide} wide`;
}

/** `?bare=still` stays the surface alone however wide the frame, and does
 *  not start replaying the cut after the hold. */
export async function bareStill(page, url) {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto(`${url}?bare=still`);
  await page.waitForTimeout(1000);
  const before = await page.locator('.rs-bare canvas').screenshot();
  await page.waitForTimeout(4000);
  const after = await page.locator('.rs-bare canvas').screenshot();
  const n = await page.locator('.rs-bare canvas').count();
  if (n !== 1) return `${n} canvases`;
  return before.equals(after) ? '' : 'the cut changed after the hold';
}

/** Export SVG downloads the finished cut with a link back to its settings,
 *  and Open SVG restores them from it. */
export async function exportSvg(page, url) {
  await page.goto(url);
  await page.waitForTimeout(1000);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export SVG' }).click()]);
  const chunks = [];
  for await (const c of await download.createReadStream()) chunks.push(c);
  const svg = Buffer.concat(chunks).toString();
  const lines = svg.match(/<polyline /g)?.length ?? 0;
  if (!/<metadata>[^<]*#s=[A-Za-z0-9_-]+<\/metadata>/.test(svg)) return 'no settings link in the metadata';
  if (download.suggestedFilename() !== 'rosee-swirl.svg') return `named ${download.suggestedFilename()}`;
  if (lines < 2) return `${lines} polylines`;

  // Open SVG brings back the settings the file was exported with.
  await page.selectOption('.rs-preset select', 'basket');
  await page.locator('input[type=file]').setInputFiles({ name: 'cut.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.waitForTimeout(500);
  const preset = await page.locator('.rs-preset select').inputValue();
  if (preset !== 'swirl') return `opening the export left the preset at ${preset}`;
  // A file dropped anywhere on the lab opens the same way.
  await page.selectOption('.rs-preset select', 'basket');
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], 'dropped.svg', { type: 'image/svg+xml' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: data, cancelable: true }));
  }, svg);
  await page.waitForTimeout(500);
  const dropped = await page.locator('.rs-preset select').inputValue();
  if (dropped !== 'swirl') return `dropping the export left the preset at ${dropped}`;
  await page.locator('input[type=file]').setInputFiles({ name: 'other.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await page.waitForTimeout(300);
  const notice = await page.getByRole('alert').filter({ hasText: 'other.svg' }).count();
  return notice ? '' : 'no notice for a file with no settings';
}
