'use client';

// The prediction ring (approved mock): serif number inside a hairline ring,
// the accent arc showing r̂/5. Unscored (wildcard / cold start) leaves the arc empty.
export default function RingGauge({
  value,
  label,
}: {
  value: number | null; // 0..5
  label?: string;
}) {
  const C = 2 * Math.PI * 33; // ≈ 207
  const fraction = value === null ? 0 : Math.max(0, Math.min(1, value / 5));
  return (
    <div className="h-[74px] w-[74px]" role="img" aria-label={label ?? (value !== null ? `Predicted ${value.toFixed(1)} out of 5` : 'Unscored')}>
      <svg viewBox="0 0 74 74" className="h-full w-full -rotate-90">
        <circle cx="37" cy="37" r="33" fill="none" stroke="#E7E7E2" strokeWidth="5" />
        {value !== null && (
          <circle
            cx="37"
            cy="37"
            r="33"
            fill="none"
            stroke="#3546E8"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        )}
        <text
          x="37"
          y="44"
          textAnchor="middle"
          fontSize="21"
          fontWeight={500}
          fill="#17181C"
          className="rotate-90 font-serif"
          style={{ transformOrigin: '37px 37px' }}
        >
          {value !== null ? value.toFixed(1) : '—'}
        </text>
      </svg>
    </div>
  );
}
