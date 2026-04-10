import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import ForceChangePasswordModal from "./ForceChangePasswordModal";

const navItems: {
  key: string;
  mobileKey?: string;
  to: string;
  end?: boolean;
  permission?: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "nav.dashboard", to: "/", end: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    key: "nav.products", to: "/products",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    key: "nav.batches", to: "/batches",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    key: "nav.transactions", mobileKey: "nav.transactionsMobile", to: "/transactions",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    key: "nav.customers", to: "/customers",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "nav.orders", to: "/orders",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    key: "nav.subdivisions", to: "/subdivisions", permission: "employees:read",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    key: "nav.payroll", to: "/payroll", permission: "payroll:read",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: "nav.employees", to: "/employees", permission: "employees:read",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 14s-1 0-1 2v1h2v-1c0-2-1-2-1-2z" />
      </svg>
    ),
  },
  {
    key: "nav.users", to: "/users", permission: "users:read",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const MAX_MOBILE_TABS = 5; // including "More"

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const { t, i18n } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const needsMore = visibleNavItems.length > MAX_MOBILE_TABS;
  const primaryItems = needsMore ? visibleNavItems.slice(0, MAX_MOBILE_TABS - 1) : visibleNavItems;
  const overflowItems = needsMore ? visibleNavItems.slice(MAX_MOBILE_TABS - 1) : [];
  const isOverflowActive = overflowItems.some(
    (item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );

  return (
    <div className="flex h-full min-h-screen bg-bluegray-50">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden md:flex flex-shrink-0 flex-row p-4">
        <div className="flex h-full w-60 flex-col rounded-3xl bg-cyan-500 px-3 py-5">
          {/* Logo */}
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              IE
            </div>
            <span className="ml-3 text-base font-bold tracking-wide text-white">Inven ERP</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "bg-cyan-300 text-white shadow-sm" : "text-cyan-100 hover:bg-cyan-400"
                  }`
                }
              >
                {item.icon}
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          {/* Bottom: language + user + logout */}
          <div className="mt-6 space-y-3 border-t border-cyan-400 pt-4">
            <div className="flex gap-1 justify-center">
              {(["uz", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    i18n.language === lang ? "bg-white text-cyan-700" : "text-cyan-100 hover:bg-cyan-400"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="text-center text-xs text-cyan-100 truncate px-1">{user?.display_name}</div>
            <button
              onClick={logout}
              className="w-full cursor-pointer rounded-2xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Mobile top bar (hidden on desktop) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-cyan-500 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              IE
            </div>
            <span className="text-sm font-bold text-white tracking-wide">Inven ERP</span>
          </div>
          <div className="flex items-center gap-2">
            {(["uz", "en"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold uppercase transition-colors ${
                  i18n.language === lang ? "bg-white text-cyan-700" : "text-cyan-100 hover:bg-cyan-400"
                }`}
              >
                {lang}
              </button>
            ))}
            <button
              onClick={logout}
              className="ml-1 cursor-pointer rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-700 transition-colors"
            >
              {t("nav.logout")}
            </button>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for tab bar */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 bg-bluegray-50">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom tab bar (hidden on desktop) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-bluegray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? "text-cyan-600" : "text-bluegray-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`transition-transform ${isActive ? "scale-110" : ""}`}>
                    {item.icon}
                  </span>
                  <span className="leading-none truncate max-w-[4rem]">{t(item.mobileKey ?? item.key)}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* "More" tab for overflow items */}
          {needsMore && (
            <div className="relative flex flex-1">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer ${
                  isOverflowActive || moreOpen ? "text-cyan-600" : "text-bluegray-400"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="leading-none">{t("nav.more", "Yana")}</span>
              </button>

              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                  <div className="absolute bottom-full right-0 mb-2 mr-1 z-40 min-w-[10rem] rounded-xl bg-white shadow-lg border border-bluegray-100 py-1">
                    {overflowItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                            isActive ? "text-cyan-600 bg-cyan-50" : "text-bluegray-600 hover:bg-bluegray-50"
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
