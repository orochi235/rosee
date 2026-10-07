/** GLSL shared by the shaders that read a carve. Each expects the uniforms
 *  it names to be declared before it. */

/** Heights and their slopes on the sheet: needs `depth`, `floor_`, `bounds`
 *  (u0, v0, u1, v1), `period` and `texels`. */
export const SHEET_GLSL = `
float heightAt(ivec2 t) {
  ivec2 size = ivec2(texels);
  ivec2 c = clamp(t, ivec2(0), size - 1);
  // round a barrel the sheet's u edges meet
  if (period > 0.0) c.x = (t.x % size.x + size.x) % size.x;
  return floor_ * (1.0 - texelFetch(depth, c, 0).r);
}

/** The height at sheet point mm and its slope along u and v; 0 off the carve. */
vec3 heightAndSlope(vec2 mm) {
  if (period > 0.0) mm.x = bounds.x + mod(mm.x - bounds.x, period);
  if (any(lessThan(mm, bounds.xy)) || any(greaterThan(mm, bounds.zw))) return vec3(0.0);
  vec2 span = bounds.zw - bounds.xy;
  vec2 uv = clamp((mm - bounds.xy) / span, vec2(0.0), 1.0 - 0.5 / texels);
  ivec2 t = ivec2(uv * texels);
  vec2 texel = span / texels;
  float dx = (heightAt(t + ivec2(1, 0)) - heightAt(t - ivec2(1, 0))) / (2.0 * texel.x);
  float dy = (heightAt(t + ivec2(0, 1)) - heightAt(t - ivec2(0, 1))) / (2.0 * texel.y);
  return vec3(heightAt(t), dx, dy);
}
`;

/** Polished metal under one distant light: needs `metal` and `roughness`. */
export const METAL_GLSL = `
vec3 litMetal(vec3 n, vec3 v, vec3 light) {
  vec3 h = normalize(light + v);
  float a2 = roughness * roughness * roughness * roughness;
  float nh = max(dot(n, h), 0.0);
  float d = a2 / (3.14159265 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
  float nl = max(dot(n, light), 0.0);
  vec3 fresnel = metal + (1.0 - metal) * pow(1.0 - max(dot(h, v), 0.0), 5.0);
  float nv = dot(n, v);
  // a dim sky reflected by every facet, so the stock reads as metal away from the highlight
  return metal * (0.12 + 0.18 * nv * nv) + fresnel * d * nl * 0.5;
}
`;
