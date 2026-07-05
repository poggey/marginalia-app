'use client';

import { DELTA_STOPS } from '@/lib/recommender/constants';

// The Discovery Range (Ch. VI): five stops on a hairline track, filled segment,
// ringed current stop. The system never moves it itself.
export default function DiscoveryRange({
  stopIndex,
  onChange,
  note,
}: {
  stopIndex: number;
  onChange: (i: number) => void;
  note: React.ReactNode;
}) {
  const stop = DELTA_STOPS[stopIndex];

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(4, stopIndex + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0, stopIndex - 1));
    }
  }

  return (
    <div className="rounded-panel border border-hairline bg-surface p-8">
      <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Discovery range</h2>
      <div className="mb-6 text-[13.5px] text-ink-2">How far from your usual should we go?</div>
      <div className="font-serif text-[24px] font-medium">{stop.name}</div>
      <div className="mb-6 min-h-[22px] text-[13.5px] text-ink-2">
        {stop.desc} · δ {stop.delta.toFixed(2)}
      </div>
      <div
        role="slider"
        aria-label="Discovery range"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={stopIndex}
        aria-valuetext={`${stop.short} — δ ${stop.delta.toFixed(2)}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative mx-1.5 my-3 h-1 cursor-pointer rounded bg-hairline"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onChange(Math.round(((e.clientX - r.left) / r.width) * 4));
        }}
      >
        <div
          className="drift-fill absolute inset-y-0 left-0 rounded bg-accent"
          style={{ width: `${stopIndex * 25}%` }}
        />
        {DELTA_STOPS.map((s, i) => {
          const cur = i === stopIndex;
          const done = i < stopIndex;
          return (
            <button
              key={s.short}
              aria-label={`${s.short} — δ ${s.delta.toFixed(2)}`}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange(i);
              }}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all ${
                cur
                  ? 'h-[22px] w-[22px] border-accent bg-surface shadow-[0_0_0_5px_#EDEFFE,0_2px_8px_rgba(53,70,232,.25)]'
                  : done
                    ? 'h-3.5 w-3.5 border-accent bg-accent'
                    : 'h-3.5 w-3.5 border-hairline bg-surface hover:border-ink-3'
              }`}
              style={{ left: `${i * 25}%`, zIndex: 2 }}
            />
          );
        })}
      </div>
      <div className="mt-4 flex justify-between text-[11px] font-medium text-ink-3">
        {DELTA_STOPS.map((s, i) => (
          <button
            key={s.short}
            onClick={() => onChange(i)}
            className={`w-1/5 transition-colors ${
              i === 0 ? 'text-left' : i === 4 ? 'text-right' : 'text-center'
            } ${i === stopIndex ? 'font-semibold text-accent' : 'hover:text-ink-2'}`}
          >
            {s.short}
          </button>
        ))}
      </div>
      <div className="mt-6 border-t border-hairline-2 pt-5 text-[13px] leading-[1.65] text-ink-2">
        {note}
      </div>
    </div>
  );
}
