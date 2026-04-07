import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const statCards = [
    { key: "dashboard.totalProducts" },
    { key: "dashboard.activeBatches" },
    { key: "dashboard.transactionsToday" },
    { key: "dashboard.lowStockAlerts" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">
        {t("dashboard.title")}
      </h1>
      <p className="text-sm text-bluegray-400 mb-8">
        {t("dashboard.welcome", { name: user?.display_name })}
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-2xl shadow p-6"
          >
            <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">
              {t(card.key)}
            </p>
            <p className="text-4xl font-bold text-bluegray-800">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
