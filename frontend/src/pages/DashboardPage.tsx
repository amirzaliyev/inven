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
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
        {t("dashboard.title")}
      </h1>
      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "#64748b" }}>
        {t("dashboard.welcome", { name: user?.display_name })}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.key}
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "13px",
                fontWeight: "500",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {t(card.key)}
            </p>
            <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#0f172a" }}>
              —
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
