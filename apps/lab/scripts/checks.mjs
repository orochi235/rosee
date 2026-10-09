// Behaviors the presets alone don't exercise. Each takes a fresh page on the
// lab's URL and returns '' when it holds, or what went wrong.

const hash = (v) => `#s=${Buffer.from(JSON.stringify(v)).toString('base64url')}`;

export async function setMode(page, mode) {
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
    for (const mode of ['lines', 'split', 'surface', 'part']) {
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
  const narrow = await page.locator('.rs-cut canvas').count();
  const narrowTransport = await page.locator('.rs-cut-bar').count();
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.waitForTimeout(800);
  const wide = await page.locator('.rs-cut canvas').count();
  const chrome = await page.locator('.rs-sidebar, .rs-parts').count();
  const transportInk = await page
    .locator('.rs-cut-bar .rs-pass')
    .evaluate((e) => getComputedStyle(e).color)
    .catch(() => null);
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
  if (narrowTransport) return 'transport drawn in the narrow bare view';
  if (transportInk === null) return 'no transport in the wide bare view';
  if (transportInk === 'rgb(0, 0, 0)') return 'transport text is black';
  return narrow === 1 && wide === 2 ? '' : `${narrow} canvases narrow, ${wide} wide`;
}

/** Once the viewer has touched the wide bare view's transport, the cut it
 *  leaves finished is not replayed under them after the hold. */
export async function bareHold(page, url) {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto(`${url}?bare`);
  // It opens finished and holds; seeking to the end then would change nothing.
  await page.locator('.rs-cut-bar button[aria-label="Pause"]').waitFor({ timeout: 6000 });
  await page.locator('.rs-cut-bar').getByRole('slider', { name: 'Position' }).focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(4500);
  const label = await page.locator('.rs-cut-bar button').first().getAttribute('aria-label');
  return label === 'Play' ? '' : 'the loop replayed after the viewer seeked';
}

/** `?bare=still` stays the surface alone however wide the frame, and does
 *  not start replaying the cut after the hold. */
export async function bareStill(page, url) {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto(`${url}?bare=still`);
  await page.waitForTimeout(1000);
  const before = await page.locator('.rs-cut canvas').screenshot();
  await page.waitForTimeout(4000);
  const after = await page.locator('.rs-cut canvas').screenshot();
  const n = await page.locator('.rs-cut canvas').count();
  if (n !== 1) return `${n} canvases`;
  if (await page.locator('.rs-cut-transport').count()) return 'transport drawn in the still';
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
  await page.getByLabel('SVG to open').setInputFiles({ name: 'cut.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
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
  await page.getByLabel('SVG to open').setInputFiles({ name: 'other.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await page.waitForTimeout(300);
  const notice = await page.getByRole('alert').filter({ hasText: 'other.svg' }).count();
  return notice ? '' : 'no notice for a file with no settings';
}

/** 0 over the output undoes a zoom. */
export async function resetKey(page, url) {
  await page.goto(url);
  await setMode(page, 'lines');
  await page.waitForTimeout(800);
  const canvas = page.locator('.rs-output > canvas');
  const box = await canvas.boundingBox();
  const before = await canvas.screenshot();
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 3);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(300);
  if ((await canvas.screenshot()).equals(before)) return 'the wheel did not zoom';
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  return (await canvas.screenshot()).equals(before) ? '' : '0 did not restore the view';
}

/** The Motion tile's Equations tab prints every stage as MathML, with a
 *  value at the playhead beside the formulas. */
export async function equationsTab(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Equations' }).click();
  await page.waitForTimeout(500);
  const maths = await page.locator('.rs-equations math').count();
  const values = await page.locator('.rs-eq-value').evaluateAll((els) => els.filter((e) => e.textContent).length);
  const broken = await page.locator('.rs-equations merror').count();
  if (errors.length) return errors.join('; ');
  if (broken) return `${broken} merror elements`;
  return maths > 10 && values > 5 ? '' : `${maths} equations, ${values} values`;
}

/** Importing a rosette drawn in an SVG makes it the rosette, as a drawn lobe,
 *  and the lab still draws. */
export async function importOutline(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForTimeout(1000);
  const points = Array.from({ length: 720 }, (_, k) => {
    const a = (k / 720) * 2 * Math.PI;
    const r = 30 + 1.2 * Math.cos(9 * a);
    return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  }).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="80mm" viewBox="-40 -40 80 80"><polygon points="${points}"/></svg>`;
  await page.locator('input[aria-label^="Rosette outline"]').setInputFiles({ name: 'nine.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await page.waitForTimeout(1500);
  const shape = await page.locator('.rs-sidebar').getByText('drawn', { exact: true }).count();
  const banner = await page.locator('.rs-error').count();
  if (errors.length) return errors.join('; ');
  if (banner) return `error banner: ${await page.locator('.rs-error').first().textContent()}`;
  return shape ? '' : 'the rosette did not become a drawn lobe';
}

/** A photo of a rosette, here a 7-lobed one drawn light on dark into a PNG,
 *  traces into a 7-lobe drawn rosette at the mean radius already set. */
export async function importPicture(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForTimeout(1000);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = '#111';
    g.fillRect(0, 0, 400, 400);
    g.fillStyle = '#ddd';
    g.beginPath();
    for (let k = 0; k <= 720; k++) {
      const a = (k / 720) * 2 * Math.PI;
      const r = 150 + 9 * Math.cos(7 * a);
      g.lineTo(200 + r * Math.cos(a), 200 - r * Math.sin(a));
    }
    g.fill();
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[aria-label^="Rosette outline"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForTimeout(1500);
  const banner = await page.locator('.rs-error').count();
  if (errors.length) return errors.join('; ');
  if (banner) return `error banner: ${await page.locator('.rs-error').first().textContent()}`;
  const hash = await page.evaluate(() => location.hash.slice(3));
  const lobes = await page.evaluate((h) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(h.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))).settings.rosette.wave.lobes, hash);
  return lobes === 7 ? '' : `traced ${lobes} lobes, not 7`;
}
