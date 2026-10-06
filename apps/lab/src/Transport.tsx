import { at, type Playhead } from './playhead';

interface Props {
  head: Playhead;
  end: number;
  samples: number;
  passes: number;
  onToggle(): void;
  onSeek(position: number): void;
  onSpeed(speed: number): void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export function Transport({ head, end, samples, passes, onToggle, onSeek, onSpeed }: Props) {
  const { pass, sample } = at(head.position, samples, passes);
  const angle = ((sample / samples) * 360).toFixed(1);
  return (
    <div className="rs-transport">
      <button type="button" onClick={onToggle} aria-label={head.playing ? 'Pause' : 'Play'}>
        {head.playing ? '❚❚' : '▶'}
      </button>
      <select value={head.speed} onChange={(e) => onSpeed(Number(e.target.value))} aria-label="Turns per second">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s} turn/s
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
      <span className="rs-readout rs-pass">
        pass {Math.min(pass + 1, passes)}/{passes}
      </span>
      <span className="rs-readout rs-angle">{angle}°</span>
    </div>
  );
}
