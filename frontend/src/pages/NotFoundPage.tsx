import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-bluegray-50 p-6">
      <div className="text-center">
        <p className="text-8xl font-bold text-cyan-500 leading-none">404</p>
        <h1 className="mt-4 text-xl font-bold text-bluegray-800">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-bluegray-400">{t("notFound.subtitle")}</p>
        <Link
          to="/"
          className="mt-6 inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {t("notFound.goHome")}
        </Link>
      </div>
    </div>
  );
}
