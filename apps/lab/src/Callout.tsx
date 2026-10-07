import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Settings } from 'rosee';
import { liveLine, type LiveContext, type PartKey, partText } from './mechanism/parts';

export interface Hover {
  part: PartKey;
  /** Where to anchor the callout, in viewport (client) pixels. */
  x: number;
  y: number;
}

/** The explanation of one part beside the pointer. It is portaled to the
 *  lab's root, under its theme but outside every tile that would clip it, and
 *  flips toward the middle of the window. */
export function Callout({ hover, live }: { hover: Hover; live: LiveContext }) {
  const text = partText(hover.part, live.settings);
  const line = liveLine(hover.part, live);
  const left = hover.x > window.innerWidth / 2;
  const up = hover.y > window.innerHeight / 2;
  const style = { '--x': `${hover.x}px`, '--y': `${hover.y}px` } as CSSProperties;
  return createPortal(
    <div className={`rs-callout${left ? ' rs-callout-left' : ''}${up ? ' rs-callout-up' : ''}`} style={style} role="tooltip">
      <strong>{text.title}</strong>
      <p>{text.what}</p>
      <p>{text.how}</p>
      {line && <p className="rs-callout-live">{line}</p>}
    </div>,
    document.querySelector('.lk-shell') ?? document.body,
  );
}

/** The same callouts for a keyboard or a touch screen: focus or tap a name. */
export function PartsList({
  parts,
  settings,
  onShow,
}: {
  parts: PartKey[];
  settings: Settings;
  onShow(part: PartKey | null, x: number, y: number): void;
}) {
  return (
    <details className="rs-parts">
      <summary>Parts</summary>
      <ul>
        {parts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onFocus={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onShow(p, r.left - 8, r.top + r.height / 2);
              }}
              onBlur={() => onShow(null, 0, 0)}
            >
              {partText(p, settings).title}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
