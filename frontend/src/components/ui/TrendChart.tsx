import { useMemo, useState } from "react";

export interface TrendChartSeries {
  id: string | number;
  name: string;
  values: number[];
}

interface TrendChartProps {
  dates: string[];
  series: TrendChartSeries[];
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

export default function TrendChart({
  dates,
  series,
  height = 220,
  formatValue = (n) => Number(n).toLocaleString("en-US"),
  emptyText = "No data",
}: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { stacks, ticks, width, padL, padR, padT, padB, barW, slotW, colored } = useMemo(() => {
    const padL = 44;
    const padR = 16;
    const padT = 14;
    const padB = 26;
    const width = 600;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    // Per-day stacked total
    const totals = dates.map((_, i) =>
      series.reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
    );
    const max = Math.max(1, ...totals);
    const niceMax = niceCeil(max);

    const slotW = dates.length > 0 ? plotW / dates.length : 0;
    const barW = Math.max(2, slotW * 0.72);

    const yScale = (v: number) => padT + plotH - (v / niceMax) * plotH;
    const xCenter = (i: number) => padL + slotW * (i + 0.5);
    const baseY = padT + plotH;

    const colored = series.map((s, idx) => ({
      ...s,
      color: PALETTE[idx % PALETTE.length],
    }));

    // Build stack rectangles per day
    const stacks = dates.map((_, i) => {
      let yCursor = baseY;
      const segments = colored
        .map((s) => {
          const v = s.values[i] ?? 0;
          if (v <= 0) return null;
          const h = baseY - yScale(v);
          const y = yCursor - h;
          yCursor = y;
          return {
            id: s.id,
            color: s.color,
            y,
            h,
            v,
          };
        })
        .filter((seg): seg is { id: string | number; color: string; y: number; h: number; v: number } => seg !== null);
      return {
        x: xCenter(i) - barW / 2,
        cx: xCenter(i),
        total: totals[i],
        segments,
      };
    });

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const v = (niceMax / tickCount) * i;
      return { v, y: yScale(v) };
    });

    return { stacks, ticks, width, padL, padR, padT, padB, barW, slotW, colored };
  }, [dates, series, height]);

  const hasData = stacks.some((s) => s.total > 0);

  if (!hasData) {
    return (
      <div className="grid place-items-center text-sm text-bluegray-400" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(dates.length / 6));
  const hoverCenter = hoverIdx !== null ? stacks[hoverIdx]?.cx ?? null : null;
  const tooltipRight = hoverCenter !== null && hoverCenter > width / 2;

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
          if (slotW === 0) return;
          const idx = Math.floor((xSvg - padL) / slotW);
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
              x={padL + slotW * (i + 0.5)}
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

        {/* Hover backdrop slot */}
        {hoverIdx !== null && (
          <rect
            x={padL + slotW * hoverIdx}
            y={padT}
            width={slotW}
            height={height - padT - padB}
            fill="var(--bg-sunken)"
            opacity={0.5}
          />
        )}

        {/* Stacked bars */}
        {stacks.map((stack, i) => (
          <g key={i}>
            {stack.segments.map((seg, j) => {
              const isLast = j === stack.segments.length - 1;
              return (
                <rect
                  key={seg.id}
                  x={stack.x}
                  y={seg.y}
                  width={barW}
                  height={Math.max(1, seg.h)}
                  rx={isLast ? 2 : 0}
                  ry={isLast ? 2 : 0}
                  fill={seg.color}
                  opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
                  style={{
                    transition: "opacity 120ms ease",
                  }}
                />
              );
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && hoverCenter !== null && stacks[hoverIdx].total > 0 && (
        <div
          className="absolute pointer-events-none px-2.5 py-1.5 rounded-md text-[11px] shadow-md"
          style={{
            background: "var(--bg-elev)",
            color: "var(--ink-900)",
            border: "1px solid var(--line)",
            top: 8,
            left: tooltipRight ? undefined : `calc(${(hoverCenter / width) * 100}% + 12px)`,
            right: tooltipRight ? `calc(${100 - (hoverCenter / width) * 100}% + 12px)` : undefined,
            minWidth: 140,
            zIndex: 2,
          }}
        >
          <div className="font-semibold mb-1 text-bluegray-700">
            {fmtDateShort(dates[hoverIdx])}
          </div>
          {colored.map((s) => {
            const v = s.values[hoverIdx] ?? 0;
            if (v === 0) return null;
            return (
              <div key={s.id} className="flex items-center gap-2 leading-tight">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-bluegray-500 truncate flex-1">{s.name}</span>
                <span className="font-semibold tabular-nums">{formatValue(v)}</span>
              </div>
            );
          })}
          <div
            className="flex items-center gap-2 leading-tight mt-1 pt-1"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <span className="text-bluegray-500 flex-1">Total</span>
            <span className="font-semibold tabular-nums">{formatValue(stacks[hoverIdx].total)}</span>
          </div>
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

export function ChartLegend({ series }: { series: TrendChartSeries[] }) {
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
