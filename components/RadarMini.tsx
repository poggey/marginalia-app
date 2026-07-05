'use client';

import { AXES, AXIS_LABELS, type Axis } from '@/lib/types';

// The live miniature taste polygon (§7.9): a 12-axis radar that grows as
// calibration ratings land. Position + label encode alongside colour (AA).
export default function RadarMini({
  values,
  size = 220,
  showLabels = true,
}: {
  values: Record<Axis, number> | null;
  size?: number;
  showLabels?: boolean;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - (showLabels ? 34 : 8);

  const point = (i: number, v: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return [cx + Math.cos(angle) * r * v, cy + Math.sin(angle) * r * v];
  };

  const gridRings = [0.33, 0.66, 1];
  const poly = values
    ? AXES.map((a, i) => point(i, Math.max(0.04, values[a] ?? 0)).join(',')).join(' ')
    : null;

  return (
    <svg width={size} height={size} role="img" aria-label="Your taste profile so far, across twelve axes">
      {gridRings.map((g) => (
        <polygon
          key={g}
          points={AXES.map((_, i) => point(i, g).join(',')).join(' ')}
          fill="none"
          stroke="#E7E7E2"
          strokeWidth={1}
        />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#EFEFEA" strokeWidth={1} />;
      })}
      {poly && (
        <polygon points={poly} fill="rgba(53,70,232,0.10)" stroke="#3546E8" strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {poly &&
        AXES.map((a, i) => {
          const [x, y] = point(i, Math.max(0.04, values![a] ?? 0));
          return <circle key={a} cx={x} cy={y} r={2.2} fill="#3546E8" />;
        })}
      {showLabels &&
        AXES.map((a, i) => {
          const [x, y] = point(i, 1.24);
          return (
            <text
              key={a}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8.5}
              fontWeight={600}
              letterSpacing="0.08em"
              fill="#9A9DA6"
            >
              {AXIS_LABELS[a].toUpperCase()}
            </text>
          );
        })}
    </svg>
  );
}
