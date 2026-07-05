'use client';

// Half-star verdict picker, 0.5–5.0. Keyboard: arrows step by 0.5.
export default function StarPicker({
  value,
  onChange,
  size = 30,
}: {
  value: number | null;
  onChange: (v: number) => void;
  size?: number;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value ?? 0) + 0.5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0.5, (value ?? 1) - 0.5));
    }
  }

  return (
    <div
      role="slider"
      aria-label="Verdict"
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value ? `${value} stars` : 'unrated'}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex select-none items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = value === null ? 0 : Math.max(0, Math.min(1, value - (star - 1)));
        return (
          <div key={star} className="relative" style={{ width: size, height: size }}>
            <Star size={size} fillFraction={fill} />
            <button
              type="button"
              aria-label={`${star - 0.5} stars`}
              onClick={() => onChange(star - 0.5)}
              className="absolute left-0 top-0 h-full w-1/2 cursor-pointer opacity-0"
              tabIndex={-1}
            />
            <button
              type="button"
              aria-label={`${star} stars`}
              onClick={() => onChange(star)}
              className="absolute right-0 top-0 h-full w-1/2 cursor-pointer opacity-0"
              tabIndex={-1}
            />
          </div>
        );
      })}
      <span className="tnum ml-2 w-8 text-[15px] font-semibold">
        {value !== null ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function Star({ size, fillFraction }: { size: number; fillFraction: number }) {
  const id = `sf-${Math.round(fillFraction * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${fillFraction * 100}%`} stopColor="#17181C" />
          <stop offset={`${fillFraction * 100}%`} stopColor="#E7E7E2" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}
