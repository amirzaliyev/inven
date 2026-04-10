import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createProduct, deleteProduct, listProducts, updateProduct, getProductCommissionRates, createCommissionRate, deleteCommissionRate } from "../api/products";
import type { Product, CommissionRate } from "../types";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import { DateInput } from "../components/DateInput";

interface EditState {
  name: string;
  sku_code: string;
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canWriteProducts = hasPermission("products:write");
  const toast = useToast();
  const confirm = useConfirm();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", sku_code: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Commission rates modal
  const [ratesProduct, setRatesProduct] = useState<Product | null>(null);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [newRateFrom, setNewRateFrom] = useState("");
  const [newRateTo, setNewRateTo] = useState("");
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const [rateDeletingId, setRateDeletingId] = useState<number | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listProducts(page, 10, search || undefined);
      setProducts(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch {
      toast("error", t("products.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedSku = skuCode.trim();

    const errs: Record<string, string> = {};
    if (!trimmedName) errs.name = t("products.validationRequired");
    if (!trimmedSku) errs.sku_code = t("products.validationRequired");
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }

    setSubmitting(true);
    setCreateErrors({});
    try {
      const created = await createProduct({ name: trimmedName, sku_code: trimmedSku });
      toast("success", t("products.createSuccess", { name: created.name }));
      setName("");
      setSkuCode("");
      setShowCreateModal(false);
      fetchProducts();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("products.createError");
      setCreateErrors({ api: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditState({ name: product.name, sku_code: product.sku_code });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ name: "", sku_code: "" });
    setEditError(null);
  }

  async function handleUpdate(productId: number) {
    const trimmedName = editState.name.trim();
    const trimmedSku = editState.sku_code.trim();

    if (!trimmedName || !trimmedSku) {
      setEditError(t("products.validationRequired"));
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateProduct(productId, { name: trimmedName, sku_code: trimmedSku });
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setEditingId(null);
      toast("success", t("products.updateSuccess", { name: updated.name }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("products.updateError");
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(product: Product) {
    const ok = await confirm({ message: t("products.deleteConfirm", { name: product.name }), danger: true });
    if (!ok) return;
    setDeletingId(product.id);
    try {
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setTotal((total) => total - 1);
      toast("success", t("products.deleteSuccess", { name: product.name }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("products.deleteError");
      toast("error", msg);
    } finally {
      setDeletingId(null);
    }
  }

  async function openRates(product: Product) {
    setRatesProduct(product);
    setRatesLoading(true);
    setRates([]);
    try {
      const data = await getProductCommissionRates(product.id);
      setRates(data);
    } catch {
      toast("error", t("commissionRates.createError"));
    } finally {
      setRatesLoading(false);
    }
  }

  async function handleAddRate(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!ratesProduct) return;
    if (!newRate) errs.rate = t("commissionRates.validationRequired");
    if (!newRateFrom) errs.effective_from = t("commissionRates.validationRequired");
    if (Object.keys(errs).length) { setRateErrors(errs); return; }
    setRateSubmitting(true);
    setRateErrors({});
    try {
      const created = await createCommissionRate(ratesProduct.id, {
        rate_per_unit: Number(newRate),
        effective_from: newRateFrom,
        effective_to: newRateTo || null,
      });
      setRates(prev => [...prev, created]);
      setNewRate(""); setNewRateFrom(""); setNewRateTo("");
      toast("success", t("commissionRates.createSuccess"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("commissionRates.createError");
      setRateErrors({ api: msg });
    } finally {
      setRateSubmitting(false);
    }
  }

  async function handleDeleteRate(rateId: number) {
    if (!ratesProduct) return;
    const ok = await confirm({ message: t("commissionRates.deleteConfirm"), danger: true });
    if (!ok) return;
    setRateDeletingId(rateId);
    try {
      await deleteCommissionRate(ratesProduct.id, rateId);
      setRates(prev => prev.filter(r => r.id !== rateId));
      toast("success", t("commissionRates.deleteSuccess"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("commissionRates.deleteError");
      toast("error", msg);
    } finally {
      setRateDeletingId(null);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white disabled:opacity-60 w-full";

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("products.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-6">{t("products.subtitle")}</p>

      {/* Product list */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("products.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{total}</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            + {t("products.addNew")}
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-3">
          <form onSubmit={handleSearch} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder={t("products.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white"
            />
            <button type="submit" className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors">
              {t("common.search")}
            </button>
            {search && (
              <button
                type="button"
                className="px-3 py-2 text-bluegray-500 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              >
                {t("common.clear")}
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : products.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">
            {search ? t("products.emptySearch") : t("products.emptyList")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.name")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("products.skuHeader")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left w-36">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-bluegray-50">
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                      <span className="text-bluegray-400 font-mono text-xs">#{product.id}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{product.name}</td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                      <span className="font-mono bg-bluegray-50 px-2 py-0.5 rounded text-xs">{product.sku_code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                      <div className="flex gap-1.5 items-center">
                        {canWriteProducts && (
                          <button onClick={() => openRates(product)} title={t("commissionRates.title")}
                            className="p-1.5 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 cursor-pointer">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        {/* Mobile: icon only */}
                        <button onClick={() => startEdit(product)} disabled={deletingId !== null}
                          className="p-1.5 text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50 cursor-pointer disabled:opacity-40 sm:hidden">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(product)} disabled={deletingId !== null}
                          className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-40 sm:hidden">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        {/* Desktop: text buttons */}
                        <button onClick={() => startEdit(product)} disabled={deletingId !== null}
                          className="hidden sm:block px-3 py-1 text-cyan-600 border border-cyan-200 rounded-lg text-sm font-medium hover:bg-cyan-50 cursor-pointer disabled:opacity-40">
                          {t("common.edit")}
                        </button>
                        <button onClick={() => handleDelete(product)} disabled={deletingId !== null}
                          className="hidden sm:block px-3 py-1 text-red-500 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 cursor-pointer disabled:opacity-40">
                          {deletingId === product.id ? t("products.deleting") : t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`}
                  onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
                >
                  <span className="sm:hidden">←</span>
                  <span className="hidden sm:inline">← {t("common.previous")}</span>
                </button>
                <span className="text-xs">{t("common.pageOf", { page, total: totalPages })}</span>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page >= totalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`}
                  onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                >
                  <span className="sm:hidden">→</span>
                  <span className="hidden sm:inline">{t("common.next")} →</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setName(""); setSkuCode(""); setCreateErrors({}); }} title={t("products.addNew")}>
        <form onSubmit={async (e) => { await handleCreate(e); if (!submitting) setShowCreateModal(false); }} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("products.nameLabel")} <span className="text-red-400">*</span></label>
            <input type="text" placeholder={t("products.namePlaceholder")} value={name} onChange={(e) => { setName(e.target.value); setCreateErrors(prev => { const { name: _, ...rest } = prev; return rest; }); }} disabled={submitting} className={`${inputCls} ${createErrors.name ? "!border-red-400" : ""}`} autoFocus />
            <p className="text-xs text-red-600 min-h-4">{createErrors.name ?? "\u00A0"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("products.skuLabel")} <span className="text-red-400">*</span></label>
            <input type="text" placeholder={t("products.skuPlaceholder")} value={skuCode} onChange={(e) => { setSkuCode(e.target.value); setCreateErrors(prev => { const { sku_code: _, ...rest } = prev; return rest; }); }} disabled={submitting} className={`${inputCls} ${createErrors.sku_code ? "!border-red-400" : ""}`} />
            <p className="text-xs text-red-600 min-h-4">{createErrors.sku_code ?? "\u00A0"}</p>
          </div>
          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowCreateModal(false); setName(""); setSkuCode(""); setCreateErrors({}); }} className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={submitting} className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${submitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}>
              {submitting ? t("products.creating") : t("products.create")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={editingId !== null} onClose={cancelEdit} title={t("common.edit")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("products.nameLabel")}</label>
            <input type="text" value={editState.name} onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))} disabled={editSubmitting} autoFocus className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("products.skuLabel")}</label>
            <input type="text" value={editState.sku_code} onChange={(e) => setEditState((s) => ({ ...s, sku_code: e.target.value }))} disabled={editSubmitting} className={inputCls} />
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer">
              {t("common.cancel")}
            </button>
            <button onClick={() => editingId !== null && handleUpdate(editingId)} disabled={editSubmitting} className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${editSubmitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}>
              {editSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Commission rates modal */}
      <Modal open={ratesProduct !== null} onClose={() => { setRatesProduct(null); setNewRate(""); setNewRateFrom(""); setNewRateTo(""); setRateErrors({}); }} title={ratesProduct ? t("commissionRates.ratesFor", { name: ratesProduct.name }) : ""} size="lg">
        {ratesLoading ? (
          <div className="py-6 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : (
          <div className="flex flex-col gap-4">
            {rates.length === 0 ? (
              <div className="py-4 text-center text-sm text-bluegray-400">{t("commissionRates.emptyList")}</div>
            ) : (
              <div className="border border-bluegray-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-left">{t("commissionRates.effectiveFrom")}</th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-left">{t("commissionRates.effectiveTo")}</th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-right">{t("commissionRates.ratePerUnit")}</th>
                      {canWriteProducts && <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 w-12"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map(r => (
                      <tr key={r.id} className="hover:bg-bluegray-50">
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100">{r.effective_from}</td>
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100">{r.effective_to ?? t("commissionRates.open")}</td>
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{r.rate_per_unit}</td>
                        {canWriteProducts && (
                          <td className="px-4 py-2 border-b border-bluegray-100">
                            <button onClick={() => handleDeleteRate(r.id)} disabled={rateDeletingId === r.id}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canWriteProducts && (
              <form onSubmit={handleAddRate} className="flex flex-col gap-3 pt-2 border-t border-bluegray-100">
                <h4 className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("commissionRates.addRate")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-bluegray-500">{t("commissionRates.ratePerUnit")} <span className="text-red-400">*</span></label>
                    <input type="number" step="0.0001" value={newRate} onChange={e => { setNewRate(e.target.value); setRateErrors(prev => { const { rate: _, ...rest } = prev; return rest; }); }} className={`${inputCls} w-full ${rateErrors.rate ? "!border-red-400" : ""}`} disabled={rateSubmitting} />
                    <p className="text-xs text-red-600 min-h-4">{rateErrors.rate ?? "\u00A0"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-bluegray-500">{t("commissionRates.effectiveFrom")} <span className="text-red-400">*</span></label>
                    <DateInput value={newRateFrom} onChange={(v: string) => { setNewRateFrom(v); setRateErrors(prev => { const { effective_from: _, ...rest } = prev; return rest; }); }} className={`${inputCls} w-full ${rateErrors.effective_from ? "!border-red-400" : ""}`} />
                    <p className="text-xs text-red-600 min-h-4">{rateErrors.effective_from ?? "\u00A0"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-bluegray-500">{t("commissionRates.effectiveTo")}</label>
                    <DateInput value={newRateTo} onChange={setNewRateTo} className={`${inputCls} w-full`} />
                  </div>
                </div>
                {rateErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{rateErrors.api}</p>}
                <div className="flex justify-end">
                  <button type="submit" disabled={rateSubmitting} className={`px-4 py-2 rounded-xl text-sm font-semibold text-white ${rateSubmitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}>
                    {rateSubmitting ? t("commissionRates.creating") : t("commissionRates.create")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
