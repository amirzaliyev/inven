import React, { useCallback, useEffect, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { DateInput } from "../components/DateInput";
import { Modal } from "../components/Modal";
import { AsyncSelect } from "../components/AsyncSelect";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { confirmBatch, createBatch, listBatches, updateBatch } from "../api/batches";
import { listProducts } from "../api/products";
import { listSubdivisions, getSubdivision } from "../api/subdivisions";
import type { Batch, BatchCreate, BatchUpdate, SubDivisionMember } from "../types";
import { formatDate } from "../utils/date";
import { PageHead, Button, ListCard, ListRow, EmptyState, StatusPill } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

interface EditState {
  batch_date: string;
  product_id: string;
  quantity: string;
  subdivision_id: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: BatchCreate = {
  batch_date: todayIso(),
  product_id: 0,
  quantity: 1,
  subdivision_id: null,
  absent_employee_ids: [],
};

const FactoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V10l5 3V10l5 3V7l4-3v17" />
    <path d="M9 21v-4h2v4" />
    <path d="M14 21v-4h2v4" />
  </svg>
);

export default function BatchesPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const auth = useAuth() as { permissions?: string[]; user?: { permissions?: string[]; role?: string } } | null;
  const perms: string[] =
    (auth && (auth.permissions ?? auth.user?.permissions)) || [];
  const canWriteBatches =
    !auth ||
    perms.length === 0 ||
    perms.includes("batches:write") ||
    perms.includes("write:batches") ||
    auth.user?.role === "admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("size")) || 10;

  const [batches, setBatches] = useState<Batch[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<BatchCreate>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [subdivisionId, setSubdivisionId] = useState<number | "">("");
  const [subdivisionMembers, setSubdivisionMembers] = useState<SubDivisionMember[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<number>>(new Set());

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    batch_date: "",
    product_id: "",
    quantity: "",
    subdivision_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBatches(page, pageSize);
      setBatches(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch (err: unknown) {
      toast("error", extractMessage(err, t("batches.loadError")));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, t]);

  const fetchProductOptions = useCallback(
    (q: string) => listProducts(1, 50, q || undefined).then((r) => r.items.map((p) => ({ value: p.id, label: `${p.name} (${p.sku_code})` }))),
    []
  );

  const fetchSubdivisionOptions = useCallback(
    (q: string) => listSubdivisions(1, 50, q || undefined).then((r) => r.items.map((s) => ({ value: s.id, label: s.name }))),
    []
  );

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  async function handleSubdivisionChange(val: number | "") {
    setSubdivisionId(val);
    setAbsentIds(new Set());
    setSubdivisionMembers([]);
    if (val !== "") {
      try {
        const sub = await getSubdivision(val);
        setSubdivisionMembers(sub.members);
      } catch {
        // silently ignore
      }
    }
  }

  function extractMessage(err: unknown, fallback: string): string {
    if (
      err &&
      typeof err === "object" &&
      "response" in err &&
      (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
    ) {
      const detail = (err as { response: { data: { detail: unknown } } }).response.data.detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? String(d)).join("; ");
    }
    if (err instanceof Error) return err.message;
    return fallback;
  }

  function resetCreateModal() {
    setForm(EMPTY_FORM);
    setSubdivisionId("");
    setSubdivisionMembers([]);
    setAbsentIds(new Set());
    setCreateErrors({});
  }

  function openCreate() {
    resetCreateModal();
    setShowCreateModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.product_id) errs.product_id = t("batches.validationRequired");
    if (form.quantity < 1) errs.quantity = t("batches.quantityMin");
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }
    setCreating(true);
    try {
      setCreateErrors({});
      const payload: BatchCreate = {
        ...form,
        subdivision_id: subdivisionId !== "" ? subdivisionId : null,
        absent_employee_ids: Array.from(absentIds),
      };
      await createBatch(payload);
      toast("success", t("batches.createSuccess"));
      resetCreateModal();
      setShowCreateModal(false);
      await fetchBatches();
    } catch (err: unknown) {
      setCreateErrors({ api: extractMessage(err, t("batches.createError")) });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(batch: Batch) {
    setEditingId(batch.id);
    setEditState({
      batch_date: batch.batch_date,
      product_id: String(batch.product_id),
      quantity: String(batch.quantity),
      subdivision_id: "",
    });
    setEditErrors({});
    setShowEditModal(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErrors({});
    setShowEditModal(false);
  }

  async function saveEdit(batchId: number) {
    const payload: BatchUpdate = {};
    if (editState.batch_date) payload.batch_date = editState.batch_date;
    if (editState.product_id) payload.product_id = Number(editState.product_id);
    if (editState.quantity) payload.quantity = Number(editState.quantity);
    if (editState.subdivision_id !== "") payload.subdivision_id = editState.subdivision_id ? Number(editState.subdivision_id) : null;

    const errs: Record<string, string> = {};
    if (payload.quantity !== undefined && payload.quantity < 1) {
      errs.quantity = t("batches.quantityMin");
    }
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setSaving(true);
    try {
      setEditErrors({});
      const updated = await updateBatch(batchId, payload);
      setBatches((prev) => prev.map((b) => (b.id === batchId ? updated : b)));
      setEditingId(null);
      setShowEditModal(false);
      toast("success", t("batches.updateSuccess", { id: batchId }));
    } catch (err: unknown) {
      setEditErrors({ api: extractMessage(err, t("batches.updateError")) });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(batchId: number) {
    const ok = await confirm({ message: t("batches.confirmConfirm"), danger: false });
    if (!ok) return;
    setConfirmingId(batchId);
    try {
      const confirmed = await confirmBatch(batchId);
      setBatches((prev) => prev.map((b) => (b.id === batchId ? confirmed : b)));
      toast("success", t("batches.confirmSuccess", { id: batchId }));
    } catch (err: unknown) {
      toast("error", extractMessage(err, t("batches.confirmError")));
    } finally {
      setConfirmingId(null);
    }
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setSearchParams({ page: String(p), size: String(pageSize) });
  }

  const hasBatches = batches.length > 0;
  const editingBatch = editingId !== null ? batches.find((b) => b.id === editingId) ?? null : null;

  return (
    <div className="page">
      <PageHead
        title={t("batches.title", "Ishlab chiqarish")}
        subtitle={t("batches.totalCount", { total })}
        actions={canWriteBatches && <Button onClick={openCreate}>{t("batches.addNew", "Yangi partiya")}</Button>}
      />

      {/* Mobile list */}
      <div className="md:hidden">
        {loading && !hasBatches ? (
          <ListCard>
            <div className="row row-static">
              <div className="row-body">
                <div className="row-title">{t("common.loading")}</div>
              </div>
            </div>
          </ListCard>
        ) : !hasBatches ? (
          <EmptyState
            icon={<FactoryIcon />}
            title={t("batches.emptyList", "Partiyalar topilmadi")}
            description={t("batches.emptyHint", "Yangi partiya qo'shing")}
          />
        ) : (
          <ListCard>
            {batches.map((batch) => {
              const canEdit = !batch.is_confirmed && canWriteBatches;
              return (
                <ListRow
                  key={batch.id}
                  avatar={
                    <div className="text-cyan-600 bg-cyan-50 rounded-xl p-2 flex items-center justify-center">
                      <FactoryIcon />
                    </div>
                  }
                  title={batch.product_name ?? `#${batch.product_id}`}
                  subtitle={
                    <span className="flex items-center gap-2 flex-wrap">
                      <span>{formatDate(batch.batch_date, i18n.language)}</span>
                      <span>·</span>
                      <span>{batch.subdivision?.name ?? "—"}</span>
                      <StatusPill variant={batch.is_confirmed ? "success" : "warn"}>
                        {batch.is_confirmed ? t("batches.confirmed") : t("batches.pending")}
                      </StatusPill>
                    </span>
                  }
                  metric={{ value: batch.quantity.toLocaleString(), unit: "dona" }}
                  onClick={canEdit ? () => startEdit(batch) : undefined}
                />
              );
            })}
          </ListCard>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        {loading && !hasBatches ? (
          <ListCard>
            <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
          </ListCard>
        ) : !hasBatches ? (
          <EmptyState
            icon={<FactoryIcon />}
            title={t("batches.emptyList", "Partiyalar topilmadi")}
            description={t("batches.emptyHint", "Yangi partiya qo'shing")}
          />
        ) : (
          <ListCard>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("batches.batchDate")}</th>
                  <th>{t("common.product")}</th>
                  <th>{t("batches.subdivision")}</th>
                  <th className="num">{t("common.quantity")}</th>
                  <th>{t("common.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const canEdit = !batch.is_confirmed;
                  return (
                    <tr key={batch.id}>
                      <td>{formatDate(batch.batch_date, i18n.language)}</td>
                      <td>{batch.product_name ?? `#${batch.product_id}`}</td>
                      <td>{batch.subdivision?.name ?? "—"}</td>
                      <td className="num tabular-nums">{batch.quantity.toLocaleString()}</td>
                      <td>
                        <StatusPill variant={batch.is_confirmed ? "success" : "warn"}>
                          {batch.is_confirmed ? t("batches.confirmed") : t("batches.pending")}
                        </StatusPill>
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          {canEdit && canWriteBatches && (
                            <>
                              <Button size="sm" variant="warn" onClick={() => startEdit(batch)}>
                                {t("common.edit")}
                              </Button>
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => handleConfirm(batch.id)}
                                disabled={confirmingId === batch.id}
                              >
                                {confirmingId === batch.id ? t("batches.confirming") : t("batches.confirm")}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ListCard>
        )}
      </div>

      {/* Pagination */}
      {hasBatches && (
        <div className="flex items-center justify-between gap-2 flex-wrap mt-4 text-sm text-bluegray-500">
          <span className="text-xs">{t("batches.pageInfo", { page, totalPages, total })}</span>
          <div className="flex items-center gap-2">
            <label className="hidden md:flex text-xs text-bluegray-500 items-center gap-1">
              {t("common.perPage")}
              <select
                value={pageSize}
                onChange={(e) => setSearchParams({ page: "1", size: e.target.value })}
                className="ml-1 px-2 py-1 border border-bluegray-200 rounded-lg text-xs bg-white outline-none"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              ← {t("common.previous")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              {t("common.next")} →
            </Button>
          </div>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetCreateModal(); setCreateErrors({}); }}
        title={t("batches.newBatch")}
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label" htmlFor="batch_date">{t("batches.batchDate")}</label>
            <DateInput
              id="batch_date"
              value={form.batch_date}
              onChange={(v) => setForm((f) => ({ ...f, batch_date: v }))}
              className="input"
            />
          </div>

          <div className="field">
            <label className="field-label">{t("common.product")} <span className="text-red-400">*</span></label>
            <AsyncSelect
              value={form.product_id === 0 ? "" : form.product_id}
              onChange={(v) => { setForm((f) => ({ ...f, product_id: v === "" ? 0 : (v as number) })); setCreateErrors((e) => { const { product_id: _p, ...rest } = e; return rest; }); }}
              fetchOptions={fetchProductOptions}
              placeholder={t("common.selectProduct")}
              className={`input ${createErrors.product_id ? "!border-red-400" : ""}`}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.product_id ?? " "}</p>
          </div>

          <div className="field">
            <label className="field-label">{t("batches.subdivision")}</label>
            <AsyncSelect
              value={subdivisionId}
              onChange={(v) => handleSubdivisionChange(v as number | "")}
              fetchOptions={fetchSubdivisionOptions}
              placeholder={t("batches.subdivisionPlaceholder")}
              className="input"
            />
          </div>

          {subdivisionMembers.length > 0 && (
            <div className="field">
              <div className="flex items-center justify-between">
                <label className="field-label">{t("batches.attendance")}</label>
                <span className="text-xs text-bluegray-400">{t("batches.attendanceHint")}</span>
              </div>
              <div className="border border-bluegray-200 rounded-xl p-3 flex flex-col gap-2 max-h-48 overflow-y-auto bg-bluegray-50">
                {subdivisionMembers.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer select-none text-sm text-bluegray-700">
                    <input
                      type="checkbox"
                      checked={!absentIds.has(m.employee_id)}
                      onChange={(e) => {
                        setAbsentIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.delete(m.employee_id);
                          } else {
                            next.add(m.employee_id);
                          }
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded accent-cyan-500"
                    />
                    {m.employee_name ?? `#${m.employee_id}`}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="quantity">{t("common.quantity")} <span className="text-red-400">*</span></label>
            <input
              id="quantity"
              type="number"
              value={form.quantity || ""}
              min={1}
              required
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => { setForm((f) => ({ ...f, quantity: e.target.value === "" ? 0 : Number(e.target.value) })); setCreateErrors((er) => { const { quantity: _q, ...rest } = er; return rest; }); }}
              className={`input ${createErrors.quantity ? "!border-red-400" : ""}`}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.quantity ?? " "}</p>
          </div>

          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreateModal(false); resetCreateModal(); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? t("batches.creating") : t("batches.create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={showEditModal && editingBatch !== null}
        onClose={cancelEdit}
        title={t("batches.editBatch", "Partiyani tahrirlash")}
      >
        {editingBatch && (
          <form
            onSubmit={(e) => { e.preventDefault(); saveEdit(editingBatch.id); }}
            className="flex flex-col gap-4"
          >
            <div className="field">
              <label className="field-label">{t("batches.batchDate")}</label>
              <DateInput
                value={editState.batch_date}
                onChange={(v) => setEditState((s) => ({ ...s, batch_date: v }))}
                className="input"
              />
            </div>

            <div className="field">
              <label className="field-label">{t("common.product")}</label>
              <AsyncSelect
                value={editState.product_id === "" ? "" : Number(editState.product_id)}
                onChange={(v) => setEditState((s) => ({ ...s, product_id: v === "" ? "" : String(v) }))}
                fetchOptions={fetchProductOptions}
                placeholder={t("common.selectProduct")}
                className="input"
              />
            </div>

            <div className="field">
              <label className="field-label">{t("common.quantity")}</label>
              <input
                type="number"
                value={editState.quantity}
                min={1}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => { setEditState((s) => ({ ...s, quantity: e.target.value })); setEditErrors((er) => { const { quantity: _q, ...rest } = er; return rest; }); }}
                className={`input ${editErrors.quantity ? "!border-red-400" : ""}`}
              />
              <p className="text-xs text-red-600 min-h-4">{editErrors.quantity ?? " "}</p>
            </div>

            <div className="field">
              <label className="field-label">{t("batches.subdivision")}</label>
              <AsyncSelect
                value={editState.subdivision_id === "" ? "" : Number(editState.subdivision_id)}
                onChange={(v) => setEditState((s) => ({ ...s, subdivision_id: v === "" ? "" : String(v) }))}
                fetchOptions={fetchSubdivisionOptions}
                placeholder={t("batches.subdivisionPlaceholder")}
                className="input"
              />
            </div>

            {editErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErrors.api}</p>}

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              {canWriteBatches && !editingBatch.is_confirmed && (
                <Button
                  type="button"
                  variant="success"
                  onClick={() => handleConfirm(editingBatch.id)}
                  disabled={saving || confirmingId === editingBatch.id}
                >
                  {confirmingId === editingBatch.id ? t("batches.confirming") : t("batches.confirm")}
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
