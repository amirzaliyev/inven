import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getDashboard } from "../api/dashboard";
import type { DashboardData } from "../types";

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

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();

  const canView = hasPermission("dashboard:view");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    getDashboard()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [canView]);

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
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
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

      {/* Hero revenue (compact, inline so'm) */}
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

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock levels */}
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

        {/* Today's production */}
        <div className="list-card overflow-hidden">
          <div
            className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <span className="text-[13px] font-semibold text-bluegray-700">{t("dashboard.todayProduction")}</span>
            <span className="text-[11px] font-medium text-bluegray-400 uppercase tracking-wider">
              {data.today_production.length}
            </span>
          </div>
          {data.today_production.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-bluegray-400">{t("dashboard.noProduction")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-sunken)" }}>
                    <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-left">{t("dashboard.product")}</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-right">{t("dashboard.totalQty")}</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-right">{t("dashboard.batches")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.today_production.map((p) => (
                    <tr
                      key={p.product_id}
                      className="hover:bg-bluegray-50 transition-colors"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td className="px-5 py-2.5 text-bluegray-700">{p.product_name}</td>
                      <td className="px-5 py-2.5 text-right text-bluegray-700 tabular-nums font-semibold">{fmtNum(p.total_quantity)}</td>
                      <td className="px-5 py-2.5 text-right text-bluegray-500">{p.batch_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Today's sales */}
        <div className="list-card overflow-hidden lg:col-span-2">
          <div
            className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <span className="text-[13px] font-semibold text-bluegray-700">
              {t("dashboard.todaySales", "Today's Sales")}
            </span>
            <span className="text-[11px] font-medium text-bluegray-400 uppercase tracking-wider">
              {data.today_sales.length}
            </span>
          </div>
          {data.today_sales.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-bluegray-400">
              {t("dashboard.noSales", "No sales today.")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-sunken)" }}>
                    <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-left">{t("dashboard.product")}</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-right">{t("dashboard.totalQty")}</th>
                    <th className="text-[10px] font-semibold uppercase tracking-wider text-bluegray-500 px-5 py-2 text-right">
                      {t("dashboard.salesOrders", "Orders")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.today_sales.map((s) => (
                    <tr
                      key={s.product_id}
                      className="hover:bg-bluegray-50 transition-colors"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td className="px-5 py-2.5 text-bluegray-700">{s.product_name}</td>
                      <td className="px-5 py-2.5 text-right text-bluegray-700 tabular-nums font-semibold">{fmtNum(s.total_quantity)}</td>
                      <td className="px-5 py-2.5 text-right text-bluegray-500">{s.order_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
