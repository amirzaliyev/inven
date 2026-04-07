import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

const navItems: { key: string; mobileKey?: string; to: string; end?: boolean; icon: React.ReactNode }[] = [
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
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  return (
    <div className="flex h-full min-h-screen bg-bluegray-50">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden md:flex flex-shrink-0 flex-row p-4">
        <div className="flex h-full w-56 flex-col rounded-3xl bg-cyan-500 px-3 py-5">
          {/* Logo */}
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              IE
            </div>
            <span className="ml-3 text-base font-bold tracking-wide text-white">Inven ERP</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
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
          {navItems.map((item) => (
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
                  <span className="leading-none">{t(item.mobileKey ?? item.key)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  );
}
