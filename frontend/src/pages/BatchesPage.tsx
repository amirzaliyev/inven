import React, { useCallback, useEffect, useState } from "react";
import refreshIcon from "../assets/icons/refresh.svg";
import plusIcon from "../assets/icons/plus.svg";
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

export default function BatchesPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
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

  // Subdivision + attendance state for create form
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
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErrors({});
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

  function renderEditRow(batch: Batch) {
    return (
      <tr key={batch.id} className="bg-cyan-50">
        <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{batch.id}</td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <DateInput
            value={editState.batch_date}
            onChange={(v) => setEditState((s) => ({ ...s, batch_date: v }))}
            className="w-32 px-2 py-1 border border-cyan-300 rounded-lg text-sm outline-none bg-white"
          />
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <AsyncSelect
            value={editState.product_id === "" ? "" : Number(editState.product_id)}
            onChange={(v) => setEditState((s) => ({ ...s, product_id: v === "" ? "" : String(v) }))}
            fetchOptions={fetchProductOptions}
            placeholder={t("common.selectProduct")}
            className="w-40 px-2 py-1 border border-cyan-300 rounded-lg text-sm outline-none bg-white"
          />
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <input
            type="number"
            value={editState.quantity}
            min={1}
            onChange={(e) => { setEditState((s) => ({ ...s, quantity: e.target.value })); setEditErrors((er) => { const { quantity, ...rest } = er; return rest; }); }}
            className={`w-22 px-2 py-1 border rounded-lg text-sm outline-none bg-white ${editErrors.quantity ? "!border-red-400" : "border-cyan-300"}`}
          />
          <p className="text-xs text-red-600 min-h-4">{editErrors.quantity ?? "\u00A0"}</p>
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <AsyncSelect
            value={editState.subdivision_id === "" ? "" : Number(editState.subdivision_id)}
            onChange={(v) => setEditState((s) => ({ ...s, subdivision_id: v === "" ? "" : String(v) }))}
            fetchOptions={fetchSubdivisionOptions}
            placeholder={t("batches.subdivisionPlaceholder")}
            className="w-40 px-2 py-1 border border-cyan-300 rounded-lg text-sm outline-none bg-white"
          />
        </td>
        <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">—</td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wide ${
            batch.is_confirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}>
            {batch.is_confirmed ? t("batches.confirmed") : t("batches.pending")}
          </span>
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 flex-wrap">
              <button
                className="px-2.5 py-0.5 bg-green-500 text-white rounded-lg text-xs font-medium cursor-pointer hover:bg-green-600"
                onClick={() => saveEdit(batch.id)}
                disabled={saving}
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
              <button
                className="px-2.5 py-0.5 text-red-500 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50 cursor-pointer"
                onClick={cancelEdit}
                disabled={saving}
              >
                {t("common.cancel")}
              </button>
            </div>
            {editErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErrors.api}</p>}
          </div>
        </td>
      </tr>
    );
  }

  function renderRow(batch: Batch) {
    const canEdit = !batch.is_confirmed;

    return (
      <tr key={batch.id} className="hover:bg-bluegray-50 group">
        <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-400 border-b border-bluegray-100 font-mono">
          #{batch.id}
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          {formatDate(batch.batch_date, i18n.language)}
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          {`#${batch.product_id}`}
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100 tabular-nums">
          {batch.quantity.toLocaleString()}
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{batch.subdivision?.name ?? "—"}</td>
        <td className="hidden sm:table-cell px-5 py-3 text-xs text-bluegray-400 border-b border-bluegray-100">
          {formatDate(batch.created_at, i18n.language)}
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wide ${
            batch.is_confirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}>
            {batch.is_confirmed ? t("batches.confirmed") : t("batches.pending")}
          </span>
        </td>
        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
          {canEdit && (
            <div className="flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
              <button
                className="px-3 py-1 text-bluegray-600 border border-bluegray-200 rounded-lg text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
                onClick={() => startEdit(batch)}
              >
                {t("common.edit")}
              </button>
              <button
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                onClick={() => handleConfirm(batch.id)}
                disabled={confirmingId === batch.id}
              >
                {confirmingId === batch.id ? t("batches.confirming") : t("batches.confirm")}
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("batches.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-8">&nbsp;</p>

      {/* Create modal */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetCreateModal(); setCreateErrors({}); }}
        title={t("batches.newBatch")}
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider" htmlFor="batch_date">{t("batches.batchDate")}</label>
            <DateInput
              id="batch_date"
              value={form.batch_date}
              onChange={(v) => setForm((f) => ({ ...f, batch_date: v }))}
              className="px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("common.product")} <span className="text-red-400">*</span></label>
            <AsyncSelect
              value={form.product_id === 0 ? "" : form.product_id}
              onChange={(v) => { setForm((f) => ({ ...f, product_id: v === "" ? 0 : v })); setCreateErrors((e) => { const { product_id, ...rest } = e; return rest; }); }}
              fetchOptions={fetchProductOptions}
              placeholder={t("common.selectProduct")}
              className={`px-3 py-2 border rounded-xl text-sm outline-none focus:border-cyan-400 bg-white ${createErrors.product_id ? "!border-red-400" : "border-bluegray-200"}`}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.product_id ?? "\u00A0"}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("batches.subdivision")}</label>
            <AsyncSelect
              value={subdivisionId}
              onChange={(v) => handleSubdivisionChange(v as number | "")}
              fetchOptions={fetchSubdivisionOptions}
              placeholder={t("batches.subdivisionPlaceholder")}
              className="px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 bg-white"
            />
          </div>

          {subdivisionMembers.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("batches.attendance")}</label>
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
                    Employee #{m.employee_id}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider" htmlFor="quantity">{t("common.quantity")} <span className="text-red-400">*</span></label>
            <input
              id="quantity"
              type="number"
              value={form.quantity}
              min={1}
              required
              onChange={(e) => { setForm((f) => ({ ...f, quantity: Number(e.target.value) })); setCreateErrors((er) => { const { quantity, ...rest } = er; return rest; }); }}
              className={`px-3 py-2 border rounded-xl text-sm outline-none focus:border-cyan-400 bg-white ${createErrors.quantity ? "!border-red-400" : "border-bluegray-200"}`}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.quantity ?? "\u00A0"}</p>
          </div>

          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}

          <button
            type="submit"
            disabled={creating}
            className={`w-full px-5 py-2 rounded-xl text-sm font-semibold text-white ${
              creating ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"
            }`}
          >
            {creating ? t("batches.creating") : t("batches.create")}
          </button>
        </form>
      </Modal>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-3 py-2.5 sm:px-5 sm:py-4 border-b border-bluegray-100">
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">
            {t("batches.listTitle")}{" "}
            {!loading && (
              <span className="text-bluegray-400 text-xs font-normal normal-case tracking-normal ml-1">
                {t("batches.totalCount", { total })}
              </span>
            )}
          </p>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              className="p-1.5 sm:px-3 sm:py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              onClick={() => setShowCreateModal(true)}
              title={t("batches.newBatch")}
            >
              <img src={plusIcon} alt="" className="w-5 h-5 invert sm:hidden" />
              <span className="hidden sm:inline">+ {t("batches.newBatch")}</span>
            </button>
            <button
              className="p-1.5 sm:px-3 sm:py-1.5 bg-bluegray-50 text-bluegray-600 border border-bluegray-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-bluegray-100"
              onClick={() => fetchBatches()}
              disabled={loading}
              title={t("common.refresh")}
            >
              <img src={refreshIcon} alt="" className="w-5 h-5 sm:hidden" />
              <span className="hidden sm:inline">{loading ? t("common.loading") : t("common.refresh")}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("batches.batchDate")}</th>
                <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.product")}</th>
                <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.quantity")}</th>
                <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("batches.subdivision")}</th>
                <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.createdAt")}</th>
                <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.status")}</th>
                <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {loading && batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-bluegray-400">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-bluegray-400">
                    {t("batches.emptyList")}
                  </td>
                </tr>
              ) : (
                batches.map((batch) =>
                  editingId === batch.id ? renderEditRow(batch) : renderRow(batch)
                )
              )}
            </tbody>
          </table></div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
          <span className="text-xs">{t("batches.pageInfo", { page, totalPages, total })}</span>
          <div className="flex items-center gap-2">
            <label className="hidden sm:flex text-xs text-bluegray-500 items-center gap-1">
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
            <button
              className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                page <= 1 || loading ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
              }`}
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              <span className="sm:hidden">←</span>
              <span className="hidden sm:inline">← {t("common.previous")}</span>
            </button>
            <button
              className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                page >= totalPages || loading ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
              }`}
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              <span className="sm:hidden">→</span>
              <span className="hidden sm:inline">{t("common.next")} →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
