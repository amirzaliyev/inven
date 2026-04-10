import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getDashboard } from "../api/dashboard";
import type { DashboardData } from "../types";

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
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-bluegray-400 mb-8">{t("dashboard.welcome", { name: user?.display_name })}</p>
        <div className="bg-white rounded-2xl shadow px-6 py-12 text-center">
          <p className="text-sm font-medium text-bluegray-500">{t("common.noAccess")}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-bluegray-400 mb-8">{t("dashboard.welcome", { name: user?.display_name })}</p>
        <div className="py-16 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-bluegray-400 mb-8">{t("dashboard.welcome", { name: user?.display_name })}</p>
        <div className="py-16 text-center text-sm text-red-500">{t("dashboard.loadError")}</div>
      </div>
    );
  }

  const fmt = (n: number) => Number(n).toLocaleString("en-US");
  const fmtMoney = (n: number) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })} UZS`;

  return (
    <div>
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("dashboard.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-8">{t("dashboard.welcome", { name: user?.display_name })}</p>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Revenue */}
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">{t("dashboard.revenue")}</p>
          <p className="text-2xl font-bold text-bluegray-800 tabular-nums">{fmtMoney(data.revenue_this_month)}</p>
        </div>

        {/* Orders */}
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">{t("dashboard.orders")}</p>
          <div className="flex gap-3 text-sm">
            <div><span className="text-amber-600 font-bold">{data.order_stats.draft}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.draft")}</span></div>
            <div><span className="text-green-600 font-bold">{data.order_stats.completed}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.completed")}</span></div>
            <div><span className="text-red-500 font-bold">{data.order_stats.cancelled}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.cancelled")}</span></div>
          </div>
        </div>

        {/* Workforce */}
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">{t("dashboard.workforce")}</p>
          <div className="flex gap-3 text-sm">
            <div><span className="text-blue-600 font-bold">{data.workforce.salary_employees}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.salaryEmployees")}</span></div>
            <div><span className="text-purple-600 font-bold">{data.workforce.commission_employees}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.commissionEmployees")}</span></div>
            <div><span className="text-cyan-600 font-bold">{data.workforce.subdivision_count}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.subdivisions")}</span></div>
          </div>
        </div>

        {/* Payroll */}
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">{t("dashboard.payrollStatus")}</p>
          <div className="flex gap-3 text-sm">
            <div><span className="text-amber-600 font-bold">{data.payroll_stats.draft}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.draft")}</span></div>
            <div><span className="text-cyan-600 font-bold">{data.payroll_stats.approved}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.approved")}</span></div>
            <div><span className="text-green-600 font-bold">{data.payroll_stats.paid}</span> <span className="text-bluegray-400 text-xs">{t("dashboard.paid")}</span></div>
          </div>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock levels */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-bluegray-100">
            <span className="text-sm font-semibold text-bluegray-700">{t("dashboard.stockLevels")}</span>
          </div>
          {data.stock_levels.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-bluegray-400">{t("dashboard.noStock")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-2 text-left">{t("dashboard.product")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-2 text-left">{t("dashboard.sku")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-2 text-right">{t("dashboard.quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock_levels.map(s => (
                    <tr key={s.product_id} className="hover:bg-bluegray-50">
                      <td className="px-5 py-2 text-bluegray-700 border-b border-bluegray-100">{s.product_name}</td>
                      <td className="px-5 py-2 border-b border-bluegray-100"><span className="font-mono bg-bluegray-50 px-2 py-0.5 rounded text-xs">{s.sku_code}</span></td>
                      <td className="px-5 py-2 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums font-semibold">{fmt(s.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Today's production */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-bluegray-100">
            <span className="text-sm font-semibold text-bluegray-700">{t("dashboard.todayProduction")}</span>
          </div>
          {data.today_production.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-bluegray-400">{t("dashboard.noProduction")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-2 text-left">{t("dashboard.product")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-2 text-right">{t("dashboard.totalQty")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-2 text-right">{t("dashboard.batches")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.today_production.map(p => (
                    <tr key={p.product_id} className="hover:bg-bluegray-50">
                      <td className="px-5 py-2 text-bluegray-700 border-b border-bluegray-100">{p.product_name}</td>
                      <td className="px-5 py-2 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums font-semibold">{fmt(p.total_quantity)}</td>
                      <td className="px-5 py-2 text-bluegray-500 border-b border-bluegray-100 text-right">{p.batch_count}</td>
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
