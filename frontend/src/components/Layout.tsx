import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { key: "nav.dashboard", to: "/", end: true },
  { key: "nav.products", to: "/products" },
  { key: "nav.batches", to: "/batches" },
  { key: "nav.transactions", to: "/transactions" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  return (
    <div style={{ display: "flex", height: "100%", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "220px",
          minWidth: "220px",
          backgroundColor: "#1e293b",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo / App Name */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #334155" }}>
          <span style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "0.5px", color: "#f1f5f9" }}>
            Inven ERP
          </span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "block",
                padding: "10px 20px",
                color: isActive ? "#f1f5f9" : "#94a3b8",
                backgroundColor: isActive ? "#334155" : "transparent",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: isActive ? "600" : "400",
                borderLeft: isActive ? "3px solid #3b82f6" : "3px solid transparent",
                transition: "background-color 0.15s, color 0.15s",
              })}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main area: header + content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header
          style={{
            height: "56px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 24px",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          {/* Language switcher */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["uz", "en"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: i18n.language === lang ? "700" : "400",
                  backgroundColor: i18n.language === lang ? "#1e293b" : "transparent",
                  color: i18n.language === lang ? "#f1f5f9" : "#94a3b8",
                  border: "1px solid #cbd5e1",
                  borderRadius: "5px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {lang}
              </button>
            ))}
          </div>

          <span style={{ fontSize: "14px", color: "#475569", fontWeight: "500" }}>
            {user?.display_name}
          </span>
          <button
            onClick={logout}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: "500",
              backgroundColor: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#e2e8f0")}
            onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#f1f5f9")}
          >
            {t("nav.logout")}
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "32px", backgroundColor: "#f8fafc", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
