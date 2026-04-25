import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError(t("login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || !username || !password;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: "var(--bg-elev)",
          borderRadius: "var(--r-2xl)",
          boxShadow: "var(--sh-lg)",
        }}
      >
        {/* Brand header */}
        <div
          className="px-7 pt-8 pb-7 text-white"
          style={{ background: "linear-gradient(135deg, #0d9488 0%, #115e59 100%)" }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-cyan-600 text-[14px] font-extrabold tracking-tight">
              IE
            </div>
            <span className="text-[18px] font-bold tracking-tight">Inven ERP</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight mb-1">{t("login.welcome", "Xush kelibsiz")}</h1>
          <p className="text-[13px] opacity-85">{t("login.subtitle")}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="px-7 pt-6 pb-7 flex flex-col gap-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-[11px] font-semibold uppercase tracking-wider text-bluegray-500"
            >
              {t("login.username")}
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("login.usernamePlaceholder")}
              disabled={loading}
              className="h-11 px-3.5 text-[15px] outline-none transition-colors disabled:opacity-60"
              style={{
                background: "var(--bg-elev)",
                color: "var(--ink-900)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--r-md)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-600)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--brand-100)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--line-strong)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[11px] font-semibold uppercase tracking-wider text-bluegray-500"
            >
              {t("login.password")}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.passwordPlaceholder")}
              disabled={loading}
              className="h-11 px-3.5 text-[15px] outline-none transition-colors disabled:opacity-60"
              style={{
                background: "var(--bg-elev)",
                color: "var(--ink-900)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--r-md)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-600)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--brand-100)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--line-strong)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            className={`mt-1 w-full h-11 text-[15px] font-semibold text-white transition-all ${
              isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:brightness-110"
            }`}
            style={{
              background: "var(--brand-600)",
              borderRadius: "var(--r-md)",
            }}
          >
            {loading ? t("login.signingIn") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
