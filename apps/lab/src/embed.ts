/** How the page's URL asks for the lab as a figure on someone else's page. */
export interface Embed {
  /** The finished cut alone at any size, never replayed. */
  still: boolean;
  /** A backdrop where the page is otherwise transparent, as `#rgb` to `#rrggbbaa`. */
  ground: string | null;
}

/** `?bare` presents the cut replaying, with the machine beside it once the
 *  frame is wide; `?bare=still` presents the finished cut alone, for a
 *  capture; `&bg=rrggbb` paints a backdrop under either. Null without `bare`:
 *  the full lab. */
export function embedOf(search: string): Embed | null {
  const params = new URLSearchParams(search);
  if (!params.has('bare')) return null;
  const bg = params.get('bg')?.match(/^[0-9a-f]{3,8}$/i)?.[0];
  return { still: params.get('bare') === 'still', ground: bg ? `#${bg}` : null };
}
