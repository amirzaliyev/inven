import { useMemo, useState } from "react";

export interface LineChartSeries {
  id: string | number;
  name: string;
  values: number[];
}

interface LineChartProps {
  dates: string[];
  series: LineChartSeries[];
  height?: number;
  formatValue?: (n: number) => string;
  emptyText?: string;
}

const PALETTE = [
  "var(--brand-600)",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
];

const fmtDateShort = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function LineChart({
  dates,
  series,
  height = 220,
  formatValue = (n) => Number(n).toLocaleString("en-US"),
  emptyText = "No data",
}: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { paths, ticks, width, padL, padR, padT, padB, plotW } = useMemo(() => {
    const padL = 44;
    const padR = 16;
    const padT = 14;
    const padB = 26;
    const width = 600;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    let max = 0;
    for (const s of series) for (const v of s.values) if (v > max) max = v;
    if (max === 0) max = 1;
    // Round up to a nice number for the axis
    const niceMax = niceCeil(max);

    const xStep = dates.length > 1 ? plotW / (dates.length - 1) : 0;
    const yScale = (v: number) => padT + plotH - (v / niceMax) * plotH;
    const xScale = (i: number) => padL + i * xStep;

    const paths = series.map((s, idx) => ({
      ...s,
      color: PALETTE[idx % PALETTE.length],
      d: s.values
        .map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(2)},${yScale(v).toFixed(2)}`)
        .join(" "),
      points: s.values.map((v, i) => ({ x: xScale(i), y: yScale(v), v })),
    }));

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const v = (niceMax / tickCount) * i;
      return { v, y: yScale(v) };
    });

    return { paths, ticks, width, padL, padR, padT, padB, plotW };
  }, [dates, series, height]);

  const hasData = series.length > 0 && series.some((s) => s.values.some((v) => v > 0));

  if (!hasData) {
    return (
      <div
        className="grid place-items-center text-sm text-bluegray-400"
        style={{ height }}
      >
        {emptyText}
      </div>
    );
  }

  // X-axis label sampling — show ~6 labels max regardless of range
  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));

  // Hover tooltip position
  const hoverX = hoverIdx !== null && paths[0] ? paths[0].points[hoverIdx]?.x : null;
  const tooltipRight = hoverX !== null && hoverX > width / 2;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const xPct = (e.clientX - rect.left) / rect.width;
          const xSvg = xPct * width;
          const xStep = dates.length > 1 ? plotW / (dates.length - 1) : 0;
          if (xStep === 0) return;
          const idx = Math.round((xSvg - padL) / xStep);
          if (idx >= 0 && idx < dates.length) setHoverIdx(idx);
          else setHoverIdx(null);
        }}
      >
        {/* Y-axis grid + ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={width - padR}
              y1={t.y}
              y2={t.y}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray={i === 0 ? "0" : "2 4"}
            />
            <text
              x={padL - 8}
              y={t.y + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--ink-400)"
              fontFamily="var(--font)"
            >
              {compactNum(t.v)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {dates.map((d, i) =>
          i % labelEvery === 0 || i === dates.length - 1 ? (
            <text
              key={i}
              x={padL + (dates.length > 1 ? i * (plotW / (dates.length - 1)) : 0)}
              y={height - padB + 16}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-400)"
              fontFamily="var(--font)"
            >
              {fmtDateShort(d)}
            </text>
          ) : null,
        )}

        {/* Series lines */}
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Hover crosshair + dots */}
        {hoverIdx !== null && hoverX !== null && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padT}
              y2={height - padB}
              stroke="var(--line-strong)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            {paths.map((p) => {
              const pt = p.points[hoverIdx];
              if (!pt) return null;
              return (
                <circle
                  key={p.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.5}
                  fill="var(--bg-elev)"
                  stroke={p.color}
                  strokeWidth={2}
                />
              );
            })}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && hoverX !== null && (
        <div
          className="absolute pointer-events-none px-2.5 py-1.5 rounded-md text-[11px] shadow-md"
          style={{
            background: "var(--bg-elev)",
            color: "var(--ink-900)",
            border: "1px solid var(--line)",
            top: 8,
            left: tooltipRight ? undefined : `calc(${(hoverX / width) * 100}% + 12px)`,
            right: tooltipRight ? `calc(${100 - (hoverX / width) * 100}% + 12px)` : undefined,
            minWidth: 120,
            zIndex: 2,
          }}
        >
          <div className="font-semibold mb-1 text-bluegray-700">{fmtDateShort(dates[hoverIdx])}</div>
          {paths.map((p) => (
            <div key={p.id} className="flex items-center gap-2 leading-tight">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: p.color }}
              />
              <span className="text-bluegray-500 truncate flex-1">{p.name}</span>
              <span className="font-semibold tabular-nums">
                {formatValue(p.points[hoverIdx]?.v ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / exp;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * exp;
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return Math.round(n).toString();
}

export function ChartLegend({ series }: { series: LineChartSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5">
      {series.map((s, idx) => (
        <div key={s.id} className="flex items-center gap-1.5 text-[12px] text-bluegray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: PALETTE[idx % PALETTE.length] }}
          />
          <span className="truncate max-w-[160px]">{s.name}</span>
        </div>
      ))}
    </div>
  );
}
