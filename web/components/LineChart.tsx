"use client";

// Dependency-free SVG line/area chart. Kept tiny on purpose — no charting library
// for the MVP. Values are plotted left-to-right; y-axis auto-scales with padding.

interface Props {
  values: number[];
  color: string;
  fill?: string;
  height?: number;
  baseline?: number; // optional horizontal reference line in data units
  formatY?: (v: number) => string;
}

export default function LineChart({
  values,
  color,
  fill,
  height = 160,
  baseline,
  formatY,
}: Props) {
  const width = 640;
  const pad = 8;

  if (values.length === 0) {
    return <div className="text-sm text-slate-500">无数据</div>;
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (baseline !== undefined) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const innerH = height - pad * 2;
  const innerW = width - pad * 2;

  const x = (i: number) =>
    pad + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${pad},${pad + innerH} ${line} ${pad + innerW},${pad + innerH}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
    >
      {fill && <polygon points={area} fill={fill} />}
      {baseline !== undefined && (
        <line
          x1={pad}
          x2={pad + innerW}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="#334155"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      )}
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
      <text x={pad} y={pad + 10} fill="#64748b" fontSize="11">
        {formatY ? formatY(max) : max.toFixed(2)}
      </text>
      <text x={pad} y={height - pad} fill="#64748b" fontSize="11">
        {formatY ? formatY(min) : min.toFixed(2)}
      </text>
    </svg>
  );
}
