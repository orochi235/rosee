import type { Playhead, PlayheadAt } from './playhead';

interface Props {
  head: Playhead;
  at: PlayheadAt;
  end: number;
  onToggle(): void;
  onSeek(position: number): void;
  onSpeed(speed: number): void;
}

const SPEEDS = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 0.25, 0.5, 1, 2, 4, 8];

/** Slow speeds read better as the seconds one turn takes. */
const speedLabel = (s: number): string => (s < 1 ? `${1 / s} s/turn` : `${s} turn/s`);

export function Transport({ head, at, end, onToggle, onSeek, onSpeed }: Props) {
  return (
    <div className="rs-transport">
      <button type="button" onClick={onToggle} aria-label={head.playing ? 'Pause' : 'Play'}>
        {head.playing ? '❚❚' : '▶'}
      </button>
      <select value={head.speed} onChange={(e) => onSpeed(Number(e.target.value))} aria-label="Turns per second">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {speedLabel(s)}
          </option>
        ))}
      </select>
      <input
        type="range"
        min={0}
        max={end}
        step={1}
        value={head.position}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Cut position"
      />
      <span className="rs-readout rs-pass">{at.label}</span>
      <span className="rs-readout rs-angle">{at.degrees.toFixed(1)}°</span>
    </div>
  );
}
