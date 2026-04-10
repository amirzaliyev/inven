import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { changePassword } from "../api/auth";

export default function ForceChangePasswordModal() {
  const { t } = useTranslation();
  const { user, updateToken } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user?.must_change_password) return null;

  const inputCls =
    "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white w-full";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      updateToken(response.access_token);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("auth.changePasswordError");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Non-dismissible backdrop */}
      <div className="absolute inset-0 bg-bluegray-900/50 backdrop-blur-[2px]" />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="px-7 pt-6 pb-4 border-b border-bluegray-100">
          <h2 className="text-base font-bold text-bluegray-800">{t("auth.changePassword")}</h2>
          <p className="text-sm text-bluegray-400 mt-1">{t("auth.changePasswordSubtitle")}</p>
        </div>

        <div className="px-7 py-6">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">
                {t("auth.currentPassword")}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputCls}
                disabled={submitting}
                autoFocus
                autoComplete="current-password"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">
                {t("auth.newPassword")}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls}
                disabled={submitting}
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">
                {t("auth.confirmPassword")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
                disabled={submitting}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${
                  submitting
                    ? "bg-cyan-300 cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer"
                }`}
              >
                {submitting ? t("auth.changingPassword") : t("auth.changePassword")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
