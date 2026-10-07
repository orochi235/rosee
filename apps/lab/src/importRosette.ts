import { grayOf, type Rosette, rosetteFromDxf, rosetteFromImage, rosetteFromSvg } from 'rosee';

/** The longest side, in pixels, a picture is traced at. */
const TRACE_SIZE = 1024;

/** A rosette read from a file: an SVG or DXF drawing at its own size, or a
 *  photo or scan traced and scaled to `radius`, the mean radius in mm. */
export async function importRosette(file: File, radius: number): Promise<{ rosette: Rosette; lobes: number }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.svg') || file.type === 'image/svg+xml') return rosetteFromSvg(await file.text());
  if (name.endsWith('.dxf')) return rosetteFromDxf(await file.text());
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an SVG, a DXF or a picture`);
  const bitmap = await createImageBitmap(file);
  const fit = Math.min(1, TRACE_SIZE / Math.max(bitmap.width, bitmap.height));
  const [w, h] = [Math.max(1, Math.round(bitmap.width * fit)), Math.max(1, Math.round(bitmap.height * fit))];
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser cannot read the picture');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return rosetteFromImage(grayOf(w, h, ctx.getImageData(0, 0, w, h).data), { radius });
}
