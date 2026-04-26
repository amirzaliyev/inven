import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getDashboard, getDashboardTimeseries } from "../api/dashboard";
import LineChart, { ChartLegend, type LineChartSeries } from "../components/ui/LineChart";
import type { DashboardData, DashboardTimeseries, TimeseriesRange } from "../types";

const fmtNum = (n: number) => Number(n).toLocaleString("en-US");
const fmtMoney = (n: number) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "var(--bg-sunken)" }}
    />
  );
}

function PageHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5 md:mb-6">
      <h1 className="text-[22px] md:text-[26px] font-bold tracking-tight text-bluegray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] md:text-sm text-bluegray-500">{subtitle}</p>}
    </div>
  );
}

const RANGES: TimeseriesRange[] = [7, 30, 90];

function RangePicker({
  value,
  onChange,
}: {
  value: TimeseriesRange;
  onChange: (v: TimeseriesRange) => void;
}) {
  const { t } = useTranslation();
  const labelKey: Record<TimeseriesRange, string> = {
    7: "dashboard.range7",
    30: "dashboard.range30",
    90: "dashboard.range90",
  };
  return (
    <div className="segmented" style={{ width: "auto", padding: 2 }}>
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={`segmented-item ${value === r ? "active" : ""}`}
          onClick={() => onChange(r)}
          style={{ padding: "0 12px", height: 28, fontSize: 12 }}
        >
          {t(labelKey[r])}
        </button>
      ))}
    </div>
  );
}

function SalesChartCard({
  data,
  loading,
  range,
  onRangeChange,
}: {
  data: DashboardTimeseries | null;
  loading: boolean;
  range: TimeseriesRange;
  onRangeChange: (r: TimeseriesRange) => void;
}) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<"qty" | "revenue">("qty");

  const series: LineChartSeries[] = data
    ? data.sales.map((s) => ({
        id: s.product_id,
        name: s.product_name,
        values: metric === "qty" ? s.quantity : s.revenue.map((r) => Number(r)),
      }))
    : [];

  return (
    <div className="list-card overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="text-[13px] font-semibold text-bluegray-700">
          {t("dashboard.salesTrend")}
        </span>
        <div className="flex items-center gap-2">
          <div className="segmented" style={{ width: "auto", padding: 2 }}>
            <button
              type="button"
              className={`segmented-item ${metric === "qty" ? "active" : ""}`}
              onClick={() => setMetric("qty")}
              style={{ padding: "0 12px", height: 28, fontSize: 12 }}
            >
              {t("dashboard.viewQty")}
            </button>
            <button
              type="button"
              className={`segmented-item ${metric === "revenue" ? "active" : ""}`}
              onClick={() => setMetric("revenue")}
              style={{ padding: "0 12px", height: 28, fontSize: 12 }}
            >
              {t("dashboard.viewRevenue")}
            </button>
          </div>
          <RangePicker value={range} onChange={onRangeChange} />
        </div>
      </div>
      <div className="px-3 pt-3">
        {loading || !data ? (
          <Skeleton className="h-[220px]" />
        ) : (
          <LineChart
            dates={data.dates}
            series={series}
            height={220}
            formatValue={metric === "revenue" ? fmtMoney : fmtNum}
            emptyText={t("dashboard.noTrendData")}
          />
        )}
      </div>
      {data && series.length > 0 && <ChartLegend series={series} />}
    </div>
  );
}

function ProductionChartCard({
  data,
  loading,
  range,
  onRangeChange,
}: {
  data: DashboardTimeseries | null;
  loading: boolean;
  range: TimeseriesRange;
  onRangeChange: (r: TimeseriesRange) => void;
}) {
  const { t } = useTranslation();

  const series: LineChartSeries[] = data
    ? data.production.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        values: p.quantity,
      }))
    : [];

  return (
    <div className="list-card overflow-hidden">
      <div
        className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="text-[13px] font-semibold text-bluegray-700">
          {t("dashboard.productionTrend")}
        </span>
        <RangePicker value={range} onChange={onRangeChange} />
      </div>
      <div className="px-3 pt-3">
        {loading || !data ? (
          <Skeleton className="h-[220px]" />
        ) : (
          <LineChart
            dates={data.dates}
            series={series}
            height={220}
            formatValue={fmtNum}
            emptyText={t("dashboard.noTrendData")}
          />
        )}
      </div>
      {data && series.length > 0 && <ChartLegend series={series} />}
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();

  const canView = hasPermission("dashboard:view");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [range, setRange] = useState<TimeseriesRange>(30);
  const [trend, setTrend] = useState<DashboardTimeseries | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    getDashboard()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [canView]);

  useEffect(() => {
    if (!canView) { setTrendLoading(false); return; }
    setTrendLoading(true);
    getDashboardTimeseries(range)
      .then(setTrend)
      .catch(() => setTrend(null))
      .finally(() => setTrendLoading(false));
  }, [canView, range]);

  if (!canView) {
    return (
      <div>
        <PageHead title={t("dashboard.title")} subtitle={t("dashboard.welcome", { name: user?.display_name })} />
        <div className="list-card p-10 text-center">
          <p className="text-sm font-medium text-bluegray-500">{t("common.noAccess")}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHead title={t("dashboard.title")} subtitle={t("dashboard.welcome", { name: user?.display_name })} />
        <Skeleton className="h-[120px] mb-4 max-w-sm" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHead title={t("dashboard.title")} subtitle={t("dashboard.welcome", { name: user?.display_name })} />
        <div
          className="list-card p-10 text-center"
          style={{ borderLeft: "3px solid var(--danger)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
            {t("dashboard.loadError")}
          </p>
        </div>
      </div>
    );
  }

  const totalOrdersThisMonth = data.order_stats.completed;

  return (
    <div>
      <PageHead title={t("dashboard.title")} subtitle={t("dashboard.welcome", { name: user?.display_name })} />

      {/* Hero revenue */}
      <div className="hero-stat hero-compact mb-5">
        <div className="eyebrow">{t("dashboard.revenue")}</div>
        <div className="hero-row">
          <span className="big">{fmtMoney(data.revenue_this_month)}</span>
          <span className="unit">so'm</span>
        </div>
        <div className="delta">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {totalOrdersThisMonth} {t("dashboard.orders").toLowerCase()}
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SalesChartCard
          data={trend}
          loading={trendLoading}
          range={range}
          onRangeChange={setRange}
        />
        <ProductionChartCard
          data={trend}
          loading={trendLoading}
          range={range}
          onRangeChange={setRange}
        />
      </div>

      {/* Stock levels (kept) */}
      <div className="list-card overflow-hidden">
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <span className="text-[13px] font-semibold text-bluegray-700">{t("dashboard.stockLevels")}</span>
          <span className="text-[11px] font-medium text-bluegray-400 uppercase tracking-wider">
            {data.stock_levels.length}
          </span>
        </div>
        {data.stock_levels.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-bluegray-400">{t("dashboard.noStock")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-sunken)" }}>
                  <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-left">{t("dashboard.product")}</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-left">{t("dashboard.sku")}</th>
                  <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-right">{t("dashboard.quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {data.stock_levels.map((s) => {
                  const qty = Number(s.quantity);
                  const low = qty < 50;
                  return (
                    <tr
                      key={s.product_id}
                      className="hover:bg-bluegray-50 transition-colors"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td className="px-5 py-2.5 text-bluegray-700">{s.product_name}</td>
                      <td className="px-5 py-2.5">
                        <span
                          className="font-mono text-[11px] px-2 py-0.5 rounded"
                          style={{ background: "var(--bg-sunken)", color: "var(--ink-700)" }}
                        >
                          {s.sku_code}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span
                          className={`tabular-nums font-semibold ${low ? "" : "text-bluegray-700"}`}
                          style={low ? { color: "var(--warn)" } : undefined}
                        >
                          {fmtNum(qty)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
