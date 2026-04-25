import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import {
  PageHead,
  Button,
  Searchbar,
  ListCard,
  ListRow,
  EmptyState,
  initials,
} from "../components/ui";
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

const IconEdit = (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconTrash = (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconUsers = (
  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconLock = (
  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.105.895-2 2-2s2 .895 2 2v3a2 2 0 11-4 0v-3zm-7 8a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2H7a2 2 0 00-2 2v7z" />
  </svg>
);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, t]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Debounced search: when the user pauses typing, perform search
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== search) {
        setPage(1);
        setSearch(searchInput);
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function resetCreate() {
    setFullName("");
    setPhone("");
    setComment("");
    setCreateErrors({});
  }

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
      resetCreate();
      setShowCreateModal(false);
      fetchCustomers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("customers.createError");
      setCreateErrors({ api: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(c: Customer) {
    if (!canWrite) return;
    setEditingId(c.id);
    setEditState({
      full_name: c.full_name,
      phone_number: c.phone_number ?? "",
      comment: c.comment ?? "",
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleUpdate(customerId: number) {
    if (!editState.full_name.trim()) {
      setEditError(t("customers.validationRequired"));
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateCustomer(customerId, {
        full_name: editState.full_name.trim(),
        phone_number: editState.phone_number.trim() || null,
        comment: editState.comment.trim() || null,
      });
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? updated : c)));
      setEditingId(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("customers.updateError");
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(c: Customer) {
    const ok = await confirm({
      message: t("customers.deleteConfirm", { name: c.full_name }),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(c.id);
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      setTotal((n) => n - 1);
      toast("success", t("customers.deleteSuccess", { name: c.full_name }));
      if (editingId === c.id) setEditingId(null);
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

  if (!canRead) {
    return (
      <div>
        <PageHead title={t("customers.title")} subtitle={t("customers.subtitle")} />
        <ListCard>
          <EmptyState
            icon={IconLock}
            title={t("common.noAccess")}
          />
        </ListCard>
      </div>
    );
  }

  const editingCustomer = customers.find((c) => c.id === editingId) ?? null;

  return (
    <div>
      <PageHead
        title={t("customers.title")}
        subtitle={t("customers.subtitle")}
        actions={
          canWrite ? (
            <Button onClick={() => setShowCreateModal(true)}>
              + {t("customers.addNew")}
            </Button>
          ) : null
        }
      />

      {/* Search + meta */}
      <div className="mb-4">
        <Searchbar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("customers.searchPlaceholder")}
        />
        <div className="mt-2 px-1 text-xs text-bluegray-500">
          {loading ? t("common.loading") : t("common.pageOf", { page, total: Math.max(1, totalPages) })}
          <span className="mx-1.5">·</span>
          <span className="text-bluegray-400">{total}</span>
        </div>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {loading ? (
          <ListCard>
            <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
          </ListCard>
        ) : customers.length === 0 ? (
          <ListCard>
            <EmptyState
              icon={IconUsers}
              title={search ? t("customers.emptySearch") : t("customers.emptyList")}
              description={!search && canWrite ? t("customers.subtitle") : undefined}
              action={
                !search && canWrite ? (
                  <Button onClick={() => setShowCreateModal(true)}>
                    + {t("customers.addNew")}
                  </Button>
                ) : undefined
              }
            />
          </ListCard>
        ) : (
          <ListCard>
            {customers.map((c) => {
              const sub = [c.phone_number, c.comment].filter(Boolean).join(" · ");
              return (
                <ListRow
                  key={c.id}
                  avatar={initials(c.full_name)}
                  title={c.full_name}
                  subtitle={sub || "—"}
                  onClick={canWrite ? () => startEdit(c) : undefined}
                />
              );
            })}
          </ListCard>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <ListCard>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={IconUsers}
              title={search ? t("customers.emptySearch") : t("customers.emptyList")}
              action={
                !search && canWrite ? (
                  <Button onClick={() => setShowCreateModal(true)}>
                    + {t("customers.addNew")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("customers.nameLabel")}</th>
                    <th>{t("customers.phoneHeader")}</th>
                    <th>{t("customers.commentHeader")}</th>
                    {canWrite && <th style={{ width: 140, textAlign: "right" }}>{t("common.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="grid place-items-center font-semibold"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: "var(--brand-50)",
                              color: "var(--brand-700)",
                              fontSize: 11,
                              flexShrink: 0,
                            }}
                          >
                            {initials(c.full_name)}
                          </div>
                          <span className="font-medium" style={{ color: "var(--ink-900)" }}>
                            {c.full_name}
                          </span>
                        </div>
                      </td>
                      <td>{c.phone_number ?? <span className="text-bluegray-400">—</span>}</td>
                      <td>
                        <span className="block max-w-[28ch] truncate text-bluegray-500">
                          {c.comment ?? "—"}
                        </span>
                      </td>
                      {canWrite && (
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(c)}
                              disabled={deletingId !== null}
                              title={t("common.edit")}
                            >
                              {IconEdit}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(c)}
                              disabled={deletingId !== null}
                              title={t("common.delete")}
                              style={{ color: "var(--danger)" }}
                            >
                              {IconTrash}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && customers.length > 0 && totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← {t("common.previous")}
              </Button>
              <span className="text-xs text-bluegray-500">
                {t("common.pageOf", { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")} →
              </Button>
            </div>
          )}
        </ListCard>
      </div>

      {/* Mobile pagination */}
      {!loading && customers.length > 0 && totalPages > 1 && (
        <div className="md:hidden mt-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </Button>
          <span className="text-xs text-bluegray-500">
            {t("common.pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={canWrite && showCreateModal}
        onClose={() => { setShowCreateModal(false); resetCreate(); }}
        title={t("customers.addNew")}
      >
        <form onSubmit={handleCreate} noValidate>
          <div className="field">
            <label className="field-label">
              {t("customers.nameLabel")} <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input"
              style={createErrors.full_name ? { borderColor: "var(--danger)" } : undefined}
              placeholder={t("customers.namePlaceholder")}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (createErrors.full_name) {
                  setCreateErrors((prev) => {
                    const { full_name: _, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              disabled={submitting}
              autoFocus
            />
            {createErrors.full_name && <p className="field-error">{createErrors.full_name}</p>}
          </div>

          <div className="field">
            <label className="field-label">{t("customers.phoneLabel")}</label>
            <input
              type="tel"
              className="input"
              placeholder={t("customers.phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label className="field-label">{t("customers.commentLabel")}</label>
            <textarea
              className="input"
              placeholder={t("customers.commentPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          {createErrors.api && (
            <p
              className="text-xs px-3 py-2 rounded-xl mb-2"
              style={{
                color: "var(--danger)",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              {createErrors.api}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowCreateModal(false); resetCreate(); }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("customers.creating") : t("customers.create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={canWrite && editingId !== null}
        onClose={cancelEdit}
        title={editingCustomer ? editingCustomer.full_name : t("common.edit")}
      >
        <div>
          <div className="field">
            <label className="field-label">{t("customers.nameLabel")}</label>
            <input
              type="text"
              className="input"
              value={editState.full_name}
              onChange={(e) => setEditState((s) => ({ ...s, full_name: e.target.value }))}
              disabled={editSubmitting}
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label">{t("customers.phoneLabel")}</label>
            <input
              type="tel"
              className="input"
              placeholder="+998..."
              value={editState.phone_number}
              onChange={(e) => setEditState((s) => ({ ...s, phone_number: e.target.value }))}
              disabled={editSubmitting}
            />
          </div>

          <div className="field">
            <label className="field-label">{t("customers.commentLabel")}</label>
            <textarea
              className="input"
              value={editState.comment}
              onChange={(e) => setEditState((s) => ({ ...s, comment: e.target.value }))}
              disabled={editSubmitting}
              rows={3}
            />
          </div>

          {editError && <p className="field-error mb-2">{editError}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {editingCustomer && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => editingCustomer && handleDelete(editingCustomer)}
                disabled={editSubmitting || deletingId !== null}
                style={{ color: "var(--danger)" }}
              >
                {deletingId === editingId ? t("customers.deleting") : t("common.delete")}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={cancelEdit}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => editingId !== null && handleUpdate(editingId)}
                disabled={editSubmitting}
              >
                {editSubmitting ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
