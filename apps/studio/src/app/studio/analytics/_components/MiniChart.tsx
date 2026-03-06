"use client";

interface DataPoint {
  label: string;
  value: number;
}

export function BarChart({
  data,
  color = "var(--text)",
  label,
}: {
  data: DataPoint[];
  color?: string;
  label?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 280;
  const H = 100;
  const barGap = 2;
  const barW = Math.max(4, (W - barGap * data.length) / data.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      )}
      <svg width={W} height={H + 16} viewBox={`0 0 ${W} ${H + 16}`}>
        {data.map((d, i) => {
          const barH = (d.value / max) * H;
          const x = i * (barW + barGap);
          return (
            <g key={i}>
              <rect
                x={x}
                y={H - barH}
                width={barW}
                height={barH}
                fill={color}
                rx={2}
                opacity={0.8}
              />
              {data.length <= 14 && (
                <text
                  x={x + barW / 2}
                  y={H + 12}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--text-muted)"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({
  data,
  color = "var(--text)",
  label,
}: {
  data: DataPoint[];
  color?: string;
  label?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 280;
  const H = 80;
  const step = W / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * step,
    y: H - (d.value / max) * H,
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaPath = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      )}
      <svg width={W} height={H + 16} viewBox={`0 0 ${W} ${H + 16}`}>
        <path d={areaPath} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
      </svg>
    </div>
  );
}
