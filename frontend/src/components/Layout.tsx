import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import ForceChangePasswordModal from "./ForceChangePasswordModal";

const navItems: {
  key: string;
  mobileKey?: string;
  to: string;
  end?: boolean;
  permission?: string;
  group: "main" | "ops" | "admin";
  icon: React.ReactNode;
}[] = [
  {
    key: "nav.dashboard", to: "/", end: true, group: "main",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    key: "nav.products", to: "/products", group: "main",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    key: "nav.orders", to: "/orders", group: "main",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: "nav.customers", to: "/customers", group: "main",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "nav.transactions", mobileKey: "nav.transactionsMobile", to: "/transactions", group: "ops",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    key: "nav.batches", to: "/batches", group: "ops",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    key: "nav.subdivisions", to: "/subdivisions", permission: "employees:read", group: "admin",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    key: "nav.employees", to: "/employees", permission: "employees:read", group: "admin",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    key: "nav.payroll", to: "/payroll", permission: "payroll:read", group: "admin",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "nav.users", to: "/users", permission: "users:read", group: "admin",
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const MAX_MOBILE_TABS = 5; // including "More"

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Auto-close mobile drawer + "more" menu on route change
  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const groupedItems = {
    main: visibleNavItems.filter((i) => i.group === "main"),
    ops: visibleNavItems.filter((i) => i.group === "ops"),
    admin: visibleNavItems.filter((i) => i.group === "admin"),
  };

  // Mobile bottom tabs: Dashboard, Products, Orders, Customers + More
  const mobilePrimary = visibleNavItems.slice(0, MAX_MOBILE_TABS - 1);
  const mobileOverflow = visibleNavItems.slice(MAX_MOBILE_TABS - 1);
  const isOverflowActive = mobileOverflow.some(
    (item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)),
  );

  const currentTitle =
    visibleNavItems.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))?.key
    ?? "nav.dashboard";

  const sidebarItem = (item: typeof navItems[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
          isActive
            ? "bg-cyan-50 text-cyan-700 font-semibold"
            : "text-bluegray-600 hover:bg-bluegray-100"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-cyan-600" />
          )}
          <span className="flex-shrink-0">{item.icon}</span>
          <span className="truncate">{t(item.key)}</span>
        </>
      )}
    </NavLink>
  );

  const drawerItem = (item: typeof navItems[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-5 py-3 text-[15px] font-medium transition-colors ${
          isActive
            ? "text-cyan-600 bg-cyan-50 font-semibold"
            : "text-bluegray-700 hover:bg-bluegray-100"
        }`
      }
    >
      <span className="flex-shrink-0 w-[22px] h-[22px] grid place-items-center">{item.icon}</span>
      <span className="truncate">{t(item.mobileKey ?? item.key)}</span>
    </NavLink>
  );

  return (
    <div className="flex h-full min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ─────────── Desktop sidebar ─────────── */}
      <aside
        className="hidden md:flex flex-shrink-0 flex-col w-[248px] h-screen sticky top-0"
        style={{ background: "var(--bg-elev)", borderRight: "1px solid var(--line)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-16" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cyan-600 text-white text-[13px] font-extrabold tracking-tight">
            IE
          </div>
          <span className="text-[16px] font-bold tracking-tight text-bluegray-900">Inven ERP</span>
        </div>

        {/* Nav (grouped) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groupedItems.main.length > 0 && (
            <div className="space-y-0.5">
              {groupedItems.main.map(sidebarItem)}
            </div>
          )}
          {groupedItems.ops.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-bluegray-400">
                {t("nav.groupOps", "Operatsiyalar")}
              </div>
              {groupedItems.ops.map(sidebarItem)}
            </div>
          )}
          {groupedItems.admin.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-bluegray-400">
                {t("nav.groupAdmin", "Boshqaruv")}
              </div>
              {groupedItems.admin.map(sidebarItem)}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pt-3 pb-4" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 text-xs font-semibold">
              {initials(user?.display_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-bluegray-900 truncate">{user?.display_name}</div>
              <div className="text-[11px] text-bluegray-500 truncate">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              title={t("nav.logout")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-bluegray-500 hover:bg-bluegray-100 hover:text-red-500 transition-colors cursor-pointer"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─────────── Main column ─────────── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Desktop topbar */}
        <header
          className="hidden md:flex items-center px-6 h-16 sticky top-0 z-20"
          style={{ background: "var(--bg-elev)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex-1 text-[15px] font-semibold text-bluegray-700">
            {t(currentTitle)}
          </div>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div
              className="flex p-0.5 rounded-lg"
              style={{ background: "var(--bg-sunken)" }}
            >
              {(["uz", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`cursor-pointer px-2.5 h-7 text-[11px] font-semibold uppercase tracking-wider rounded-md transition-colors ${
                    i18n.language === lang
                      ? "bg-bluegray-50 text-bluegray-900 shadow-sm"
                      : "text-bluegray-500 hover:text-bluegray-700"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-bluegray-500 hover:bg-bluegray-100 hover:text-bluegray-700 transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Mobile top app bar */}
        <header
          className="md:hidden flex items-center h-14 px-1 sticky top-0 z-20"
          style={{ background: "var(--bg-elev)", borderBottom: "1px solid var(--line)" }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-bluegray-700 hover:bg-bluegray-100 cursor-pointer"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 text-center text-[17px] font-semibold tracking-tight text-bluegray-900">
            {t(currentTitle)}
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-bluegray-700 hover:bg-bluegray-100 cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6" style={{ background: "var(--bg)" }}>
          <Outlet />
        </main>
      </div>

      {/* ─────────── Mobile drawer ─────────── */}
      <div
        className={`md:hidden drawer-scrim ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`md:hidden mobile-drawer ${drawerOpen ? "open" : ""}`}>
        {/* Header */}
        <div
          className="px-5 pt-11 pb-5 text-white"
          style={{ background: "linear-gradient(135deg, #0d9488 0%, #115e59 100%)" }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-cyan-600 text-[13px] font-extrabold tracking-tight">
              IE
            </div>
            <span className="text-[17px] font-bold tracking-tight">Inven ERP</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/25 backdrop-blur text-[15px] font-bold">
              {initials(user?.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold truncate">{user?.display_name}</div>
              <div className="text-[12px] opacity-85 truncate">{user?.role}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {groupedItems.main.map(drawerItem)}
          {groupedItems.ops.length > 0 && (
            <>
              <div className="px-5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-bluegray-400">
                {t("nav.groupOps", "Operatsiyalar")}
              </div>
              {groupedItems.ops.map(drawerItem)}
            </>
          )}
          {groupedItems.admin.length > 0 && (
            <>
              <div className="px-5 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-bluegray-400">
                {t("nav.groupAdmin", "Boshqaruv")}
              </div>
              {groupedItems.admin.map(drawerItem)}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-5 pt-3 pb-6" style={{ borderTop: "1px solid var(--line)" }}>
          <div
            className="flex p-0.5 rounded-lg mb-3"
            style={{ background: "var(--bg-sunken)" }}
          >
            {(["uz", "en"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`flex-1 cursor-pointer h-9 text-[13px] font-semibold uppercase tracking-wider rounded-md transition-colors ${
                  i18n.language === lang
                    ? "bg-bluegray-50 text-bluegray-900 shadow-sm"
                    : "text-bluegray-500"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] font-semibold text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* ─────────── Mobile bottom tab bar ─────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30"
        style={{ background: "var(--bg-elev)", borderTop: "1px solid var(--line)" }}
      >
        <div className="flex pt-1.5 pb-3.5 px-1">
          {mobilePrimary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
                  isActive ? "text-cyan-600 font-semibold" : "text-bluegray-500"
                }`
              }
            >
              {item.icon}
              <span className="leading-none truncate max-w-[5rem]">
                {t(item.mobileKey ?? item.key)}
              </span>
            </NavLink>
          ))}

          {mobileOverflow.length > 0 && (
            <div className="relative flex flex-1">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
                  isOverflowActive || moreOpen ? "text-cyan-600 font-semibold" : "text-bluegray-500"
                }`}
              >
                <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                <span className="leading-none">{t("nav.more", "Yana")}</span>
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                  <div
                    className="absolute bottom-full right-1 mb-2 z-40 min-w-[12rem] rounded-2xl py-1.5 overflow-hidden"
                    style={{
                      background: "var(--bg-elev)",
                      border: "1px solid var(--line)",
                      boxShadow: "var(--sh-lg)",
                    }}
                  >
                    {mobileOverflow.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                            isActive ? "text-cyan-600 bg-cyan-50" : "text-bluegray-700 hover:bg-bluegray-100"
                          }`
                        }
                      >
                        {item.icon}
                        <span>{t(item.mobileKey ?? item.key)}</span>
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Force password change overlay */}
      <ForceChangePasswordModal />
    </div>
  );
}
