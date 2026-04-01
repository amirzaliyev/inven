import { useAuth } from "../contexts/AuthContext";

const statCards = [
  { label: "Total Products", value: "—" },
  { label: "Active Batches", value: "—" },
  { label: "Transactions Today", value: "—" },
  { label: "Low Stock Alerts", value: "—" },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
        Dashboard
      </h1>
      <p style={{ margin: "0 0 32px", fontSize: "14px", color: "#64748b" }}>
        Welcome back, {user?.display_name}. Here's an overview of your inventory.
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
            key={card.label}
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
              {card.label}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: "700",
                color: "#0f172a",
              }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
