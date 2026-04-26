import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createProduct, deleteProduct, listProducts, updateProduct, getProductCommissionRates, createCommissionRate, deleteCommissionRate } from "../api/products";
import type { Product, CommissionRate } from "../types";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import { DateInput } from "../components/DateInput";
import { PageHead, Button, Searchbar, ListCard, ListRow, EmptyState } from "../components/ui";

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
  const [, setTotal] = useState(0);
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

  // Debounced search: as user types, push to `search` (which fires fetch)
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

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

  const boxIcon = (
    <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHead
        title={t("products.title")}
        subtitle={t("products.subtitle")}
        actions={canWriteProducts && <Button onClick={() => setShowCreateModal(true)}>{t("products.addNew")}</Button>}
      />

      <div className="mb-4">
        <Searchbar value={searchInput} onChange={setSearchInput} placeholder={t("products.searchPlaceholder")} />
      </div>

      {loading ? (
        <ListCard>
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        </ListCard>
      ) : products.length === 0 ? (
        <ListCard>
          <EmptyState
            title={t("products.emptyList")}
            description={searchInput ? t("products.emptySearch") : undefined}
            action={searchInput ? (
              <Button variant="outline" size="sm" onClick={() => setSearchInput("")}>{t("common.clear")}</Button>
            ) : undefined}
          />
        </ListCard>
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden">
            <ListCard>
              {products.map((product) => (
                <ListRow
                  key={product.id}
                  avatar={boxIcon}
                  title={product.name}
                  subtitle={<span className="font-mono text-[12px] text-bluegray-700">{product.sku_code}</span>}
                  onClick={canWriteProducts ? () => startEdit(product) : undefined}
                  trailing={canWriteProducts ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openRates(product); }}>
                        {t("commissionRates.title")}
                      </Button>
                      <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(product); }} disabled={deletingId !== null}>
                        {deletingId === product.id ? t("products.deleting") : t("common.delete")}
                      </Button>
                    </div>
                  ) : undefined}
                />
              ))}
            </ListCard>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <ListCard className="overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("common.name")}</th>
                    <th>{t("products.skuHeader")}</th>
                    <th className="text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td><span className="font-mono text-[12px] text-bluegray-700">{product.sku_code}</span></td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {canWriteProducts && (
                            <button
                              type="button"
                              title={t("common.edit")}
                              onClick={() => startEdit(product)}
                              disabled={deletingId !== null}
                              className="icon-btn"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canWriteProducts && (
                            <button
                              type="button"
                              title={t("commissionRates.title")}
                              onClick={() => openRates(product)}
                              className="icon-btn"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          {canWriteProducts && (
                            <button
                              type="button"
                              title={deletingId === product.id ? t("products.deleting") : t("common.delete")}
                              onClick={() => handleDelete(product)}
                              disabled={deletingId !== null}
                              className="icon-btn icon-btn-danger"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ListCard>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-4">
              <span className="text-sm text-bluegray-500">{t("common.pageOf", { page, total: totalPages })}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                  {t("common.previous")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setName(""); setSkuCode(""); setCreateErrors({}); }} title={t("products.addNew")}>
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label">{t("products.nameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("products.namePlaceholder")}
              value={name}
              onChange={(e) => { setName(e.target.value); setCreateErrors(prev => { const { name: _, ...rest } = prev; return rest; }); }}
              disabled={submitting}
              className="input"
              autoFocus
            />
            {createErrors.name && <p className="field-error">{createErrors.name}</p>}
          </div>
          <div className="field">
            <label className="field-label">{t("products.skuLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("products.skuPlaceholder")}
              value={skuCode}
              onChange={(e) => { setSkuCode(e.target.value); setCreateErrors(prev => { const { sku_code: _, ...rest } = prev; return rest; }); }}
              disabled={submitting}
              className="input"
            />
            {createErrors.sku_code && <p className="field-error">{createErrors.sku_code}</p>}
          </div>
          {createErrors.api && <p className="field-error">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreateModal(false); setName(""); setSkuCode(""); setCreateErrors({}); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={editingId !== null} onClose={cancelEdit} title={t("common.edit")}>
        <div className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label">{t("products.nameLabel")}</label>
            <input
              type="text"
              value={editState.name}
              onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
              disabled={editSubmitting}
              autoFocus
              className="input"
            />
          </div>
          <div className="field">
            <label className="field-label">{t("products.skuLabel")}</label>
            <input
              type="text"
              value={editState.sku_code}
              onChange={(e) => setEditState((s) => ({ ...s, sku_code: e.target.value }))}
              disabled={editSubmitting}
              className="input"
            />
          </div>
          {editError && <p className="field-error">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={cancelEdit}>{t("common.cancel")}</Button>
            <Button onClick={() => editingId !== null && handleUpdate(editingId)} disabled={editSubmitting}>
              {editSubmitting ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Commission rates modal */}
      <Modal
        open={ratesProduct !== null}
        onClose={() => { setRatesProduct(null); setNewRate(""); setNewRateFrom(""); setNewRateTo(""); setRateErrors({}); }}
        title={ratesProduct ? t("commissionRates.ratesFor", { name: ratesProduct.name }) : ""}
        size="2xl"
      >
        {ratesLoading ? (
          <div className="py-6 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : (
          <div className="flex flex-col gap-4">
            {rates.length === 0 ? (
              <div className="py-4 text-center text-sm text-bluegray-400">{t("commissionRates.emptyList")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("commissionRates.effectiveFrom")}</th>
                      <th>{t("commissionRates.effectiveTo")}</th>
                      <th className="text-right">{t("commissionRates.ratePerUnit")}</th>
                      {canWriteProducts && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map(r => (
                      <tr key={r.id}>
                        <td>{r.effective_from}</td>
                        <td>{r.effective_to ?? t("commissionRates.open")}</td>
                        <td className="text-right tabular-nums">{r.rate_per_unit}</td>
                        {canWriteProducts && (
                          <td className="text-right">
                            <Button variant="danger" size="sm" onClick={() => handleDeleteRate(r.id)} disabled={rateDeletingId === r.id}>
                              {t("common.delete")}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canWriteProducts && (
              <form onSubmit={handleAddRate} className="flex flex-col gap-3 pt-3 border-t border-bluegray-100">
                <h4 className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("commissionRates.addRate")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="field">
                    <label className="field-label">{t("commissionRates.ratePerUnit")} <span className="text-red-400">*</span></label>
                    <input
                      type="number"
                      step="0.0001"
                      value={newRate}
                      onChange={e => { setNewRate(e.target.value); setRateErrors(prev => { const { rate: _, ...rest } = prev; return rest; }); }}
                      className="input"
                      disabled={rateSubmitting}
                    />
                    {rateErrors.rate && <p className="field-error">{rateErrors.rate}</p>}
                  </div>
                  <div className="field">
                    <label className="field-label">{t("commissionRates.effectiveFrom")} <span className="text-red-400">*</span></label>
                    <DateInput
                      value={newRateFrom}
                      onChange={(v: string) => { setNewRateFrom(v); setRateErrors(prev => { const { effective_from: _, ...rest } = prev; return rest; }); }}
                      className="input"
                    />
                    {rateErrors.effective_from && <p className="field-error">{rateErrors.effective_from}</p>}
                  </div>
                  <div className="field">
                    <label className="field-label">{t("commissionRates.effectiveTo")}</label>
                    <DateInput value={newRateTo} onChange={setNewRateTo} className="input" />
                  </div>
                </div>
                {rateErrors.api && <p className="field-error">{rateErrors.api}</p>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={rateSubmitting}>
                    {rateSubmitting ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
