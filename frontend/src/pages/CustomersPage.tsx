import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "../api/customers";
import type { Customer } from "../types";

interface EditState {
  full_name: string;
  phone_number: string;
  comment: string;
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();

  const canRead = hasPermission("customers:read");
  const canWrite = hasPermission("customers:write");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ full_name: "", phone_number: "", comment: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCustomers(page, 10, search || undefined);
      setCustomers(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch {
      toast("error", t("customers.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const errs: Record<string, string> = {};
    if (!trimmedName) errs.full_name = t("customers.validationRequired");
    if (Object.keys(errs).length) { setCreateErrors(errs); return; }
    setSubmitting(true);
    setCreateErrors({});
    try {
      const created = await createCustomer({
        full_name: trimmedName,
        phone_number: phone.trim() || null,
        comment: comment.trim() || null,
      });
      toast("success", t("customers.createSuccess", { name: created.full_name }));
      setFullName(""); setPhone(""); setComment("");
      setShowCreateModal(false);
      fetchCustomers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("customers.createError");
      setCreateErrors({ api: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(c: Customer) {
    setEditingId(c.id);
    setEditState({ full_name: c.full_name, phone_number: c.phone_number ?? "", comment: c.comment ?? "" });
    setEditError(null);
  }

  function cancelEdit() { setEditingId(null); setEditError(null); }

  async function handleUpdate(customerId: number) {
    if (!editState.full_name.trim()) { setEditError(t("customers.validationRequired")); return; }
    setEditSubmitting(true); setEditError(null);
    try {
      const updated = await updateCustomer(customerId, {
        full_name: editState.full_name.trim(),
        phone_number: editState.phone_number.trim() || null,
        comment: editState.comment.trim() || null,
      });
      setCustomers(prev => prev.map(c => c.id === customerId ? updated : c));
      setEditingId(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("customers.updateError");
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(c: Customer) {
    const ok = await confirm({ message: t("customers.deleteConfirm", { name: c.full_name }), danger: true });
    if (!ok) return;
    setDeletingId(c.id);
    try {
      await deleteCustomer(c.id);
      setCustomers(prev => prev.filter(x => x.id !== c.id));
      setTotal(t => t - 1);
      toast("success", t("customers.deleteSuccess", { name: c.full_name }));
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      const msg = errData?.code === "customer_referenced"
        ? t("customers.deleteConflict")
        : (errData?.message ?? t("customers.deleteError"));
      toast("error", msg);
    } finally {
      setDeletingId(null);
    }
  }

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); setSearch(searchInput); }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  if (!canRead) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("customers.title")}</h1>
        <div className="mt-8 bg-white rounded-2xl shadow px-6 py-12 text-center">
          <svg className="w-12 h-12 text-bluegray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-medium text-bluegray-500">{t("common.noAccess")}</p>
        </div>
      </div>
    );
  }

  const editingCustomer = customers.find(c => c.id === editingId) ?? null;

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("customers.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-6">{t("customers.subtitle")}</p>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("customers.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{total}</span>
          </div>
          {canWrite && (
            <button onClick={() => setShowCreateModal(true)} className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors">
              + {t("customers.addNew")}
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-3">
          <form onSubmit={handleSearch} className="flex gap-2 items-center">
            <input type="text" placeholder={t("customers.searchPlaceholder")} value={searchInput} onChange={e => setSearchInput(e.target.value)} className={`flex-1 ${inputCls}`} />
            <button type="submit" className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors">{t("common.search")}</button>
            {search && (
              <button type="button" className="px-3 py-2 text-bluegray-500 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer" onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}>
                {t("common.clear")}
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : customers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{search ? t("customers.emptySearch") : t("customers.emptyList")}</div>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("customers.nameLabel")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("customers.phoneHeader")}</th>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("customers.commentHeader")}</th>
                  {canWrite && <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left w-36">{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-bluegray-50">
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100"><span className="text-bluegray-400 text-xs">#{c.id}</span></td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{c.full_name}</td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100"><span className="text-bluegray-400 text-xs">{c.phone_number ?? "—"}</span></td>
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100"><span className="text-bluegray-400 text-xs">{c.comment ?? "—"}</span></td>
                    {canWrite && (
                      <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        <div className="flex gap-1.5">
                          {/* Mobile: icon only */}
                          <button onClick={() => startEdit(c)} disabled={deletingId !== null}
                            className="p-1.5 text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50 cursor-pointer disabled:opacity-40 sm:hidden">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(c)} disabled={deletingId !== null}
                            className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-40 sm:hidden">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          {/* Desktop: text buttons */}
                          <button onClick={() => startEdit(c)} disabled={deletingId !== null}
                            className="hidden sm:block px-3 py-1 text-cyan-600 border border-cyan-200 rounded-lg text-sm font-medium hover:bg-cyan-50 cursor-pointer disabled:opacity-40">
                            {t("common.edit")}
                          </button>
                          <button onClick={() => handleDelete(c)} disabled={deletingId !== null}
                            className="hidden sm:block px-3 py-1 text-red-500 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 cursor-pointer disabled:opacity-40">
                            {deletingId === c.id ? t("customers.deleting") : t("common.delete")}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table></div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
                <button className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`} onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <span className="sm:hidden">←</span><span className="hidden sm:inline">← {t("common.previous")}</span>
                </button>
                <span className="text-xs">{t("common.pageOf", { page, total: totalPages })}</span>
                <button className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page >= totalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  <span className="sm:hidden">→</span><span className="hidden sm:inline">{t("common.next")} →</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal open={canWrite && showCreateModal} onClose={() => { setShowCreateModal(false); setFullName(""); setPhone(""); setComment(""); setCreateErrors({}); }} title={t("customers.addNew")}>
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("customers.nameLabel")} <span className="text-red-400">*</span></label>
            <input type="text" placeholder={t("customers.namePlaceholder")} value={fullName} onChange={e => { setFullName(e.target.value); setCreateErrors(prev => { const { full_name: _, ...rest } = prev; return rest; }); }} className={`${inputCls} ${createErrors.full_name ? "!border-red-400" : ""}`} disabled={submitting} autoFocus />
            <p className="text-xs text-red-600 min-h-4">{createErrors.full_name ?? "\u00A0"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("customers.phoneLabel")}</label>
            <input type="tel" placeholder={t("customers.phonePlaceholder")} value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} disabled={submitting} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("customers.commentLabel")}</label>
            <textarea placeholder={t("customers.commentPlaceholder")} value={comment} onChange={e => setComment(e.target.value)} className={`${inputCls} resize-y min-h-16 font-sans`} disabled={submitting} rows={2} />
          </div>
          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowCreateModal(false); setFullName(""); setPhone(""); setComment(""); setCreateErrors({}); }} className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer">{t("common.cancel")}</button>
            <button type="submit" disabled={submitting} className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${submitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}>
              {submitting ? t("customers.creating") : t("customers.create")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={canWrite && editingId !== null} onClose={cancelEdit} title={editingCustomer ? editingCustomer.full_name : t("common.edit")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("customers.nameLabel")}</label>
            <input type="text" value={editState.full_name} onChange={e => setEditState(s => ({ ...s, full_name: e.target.value }))} className={inputCls} disabled={editSubmitting} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("customers.phoneLabel")}</label>
            <input type="tel" value={editState.phone_number} onChange={e => setEditState(s => ({ ...s, phone_number: e.target.value }))} className={inputCls} disabled={editSubmitting} placeholder="+998..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("customers.commentLabel")}</label>
            <textarea value={editState.comment} onChange={e => setEditState(s => ({ ...s, comment: e.target.value }))} className={`${inputCls} resize-y min-h-16 font-sans`} disabled={editSubmitting} rows={2} />
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer">{t("common.cancel")}</button>
            <button onClick={() => editingId !== null && handleUpdate(editingId)} disabled={editSubmitting} className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${editSubmitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}>
              {editSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
