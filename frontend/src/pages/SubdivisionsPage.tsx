import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext.tsx";
import { useConfirm } from "../contexts/ConfirmContext.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Modal } from "../components/Modal.tsx";
import { AsyncSelect, type SelectOption } from "../components/AsyncSelect.tsx";
import { PageHead, Button, EmptyState } from "../components/ui/index.tsx";
import {
  addMember,
  createSubdivision,
  deleteSubdivision,
  getSubdivision,
  listSubdivisions,
  removeMember,
  updateSubdivision,
} from "../api/subdivisions.ts";
import { listEmployees } from "../api/employees.ts";
import type { SubDivision, SubDivisionMember } from "../types/index.ts";

export default function SubdivisionsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();

  const canRead = hasPermission("employees:read");
  const canWrite = hasPermission("employees:write");

  const [subdivisions, setSubdivisions] = useState<SubDivision[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createMembers, setCreateMembers] = useState<SelectOption[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Edit
  const [editingSub, setEditingSub] = useState<SubDivision | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Members
  const [membersSub, setMembersSub] = useState<SubDivision | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState<number | "">("");
  const [addEmployeeName, setAddEmployeeName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<number | null>(null);

  async function fetchEmployeeOptions(search: string): Promise<SelectOption[]> {
    const result = await listEmployees(1, 20, search || undefined);
    return result.items.map((e) => ({
      value: e.id,
      label: `${e.full_name} (${e.employee_number})`,
    }));
  }

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSubdivisions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSubdivisions(page, 12, search || undefined);
      setSubdivisions(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch {
      toast("error", t("subdivisions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    fetchSubdivisions();
  }, [fetchSubdivisions]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function openCreate() {
    setShowCreateModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!createName.trim()) errs.name = t("subdivisions.validationRequired");
    if (Object.keys(errs).length) {
      setCreateErrors(errs);
      return;
    }
    setCreateSubmitting(true);
    setCreateErrors({});
    try {
      const created = await createSubdivision({
        name: createName.trim(),
        description: createDesc.trim() || null,
      });
      // Add selected employees as members
      for (const m of createMembers) {
        try {
          await addMember(created.id, { employee_id: m.value });
        } catch { /* skip duplicates */ }
      }
      toast("success", t("subdivisions.createSuccess", { name: created.name }));
      setCreateName("");
      setCreateDesc("");
      setCreateMembers([]);
      setShowCreateModal(false);
      fetchSubdivisions();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("subdivisions.createError");
      setCreateErrors({ api: msg });
    } finally {
      setCreateSubmitting(false);
    }
  }

  function startEdit(s: SubDivision) {
    setEditingSub(s);
    setEditName(s.name);
    setEditDesc(s.description ?? "");
    setEditError(null);
  }

  async function handleUpdate() {
    if (!editingSub) return;
    if (!editName.trim()) {
      setEditError(t("subdivisions.validationRequired"));
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateSubdivision(editingSub.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      setSubdivisions((prev) =>
        prev.map((s) => s.id === updated.id ? updated : s)
      );
      toast("success", t("subdivisions.updateSuccess"));
      setEditingSub(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("subdivisions.updateError");
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(s: SubDivision) {
    const ok = await confirm({
      message: t("subdivisions.deleteConfirm", { name: s.name }),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(s.id);
    try {
      await deleteSubdivision(s.id);
      setSubdivisions((prev) => prev.filter((x) => x.id !== s.id));
      setTotal((n) => n - 1);
      toast("success", t("subdivisions.deleteSuccess"));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("subdivisions.deleteError");
      toast("error", msg);
    } finally {
      setDeletingId(null);
    }
  }

  async function openMembers(s: SubDivision) {
    setMembersLoading(true);
    setMembersSub(s);
    try {
      const full = await getSubdivision(s.id);
      setMembersSub(full);
    } catch {
      toast("error", t("subdivisions.loadError"));
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleAddMember() {
    if (!membersSub || addEmployeeId === "") return;
    setAddingMember(true);
    setMemberErrors({});
    try {
      await addMember(membersSub.id, { employee_id: addEmployeeId });
      toast("success", t("subdivisions.addMemberSuccess"));
      setAddEmployeeId("");
      setAddEmployeeName("");
      const full = await getSubdivision(membersSub.id);
      setMembersSub(full);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("subdivisions.addMemberError");
      setMemberErrors({ api: msg });
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(m: SubDivisionMember) {
    if (!membersSub) return;
    setRemovingId(m.id);
    try {
      await removeMember(membersSub.id, m.id);
      toast("success", t("subdivisions.removeMemberSuccess"));
      setMembersSub((prev) =>
        prev
          ? { ...prev, members: prev.members.filter((x) => x.id !== m.id) }
          : null
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("subdivisions.removeMemberError");
      setMemberErrors({ api: msg });
    } finally {
      setRemovingId(null);
    }
  }

  if (!canRead) {
    return (
      <div>
        <PageHead
          title={t("subdivisions.title", "Bo'linmalar")}
          subtitle={t("subdivisions.subtitle")}
        />
        <EmptyState title={t("common.noAccess")} />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title={t("subdivisions.title", "Bo'linmalar")}
        subtitle={t("subdivisions.subtitle")}
        actions={canWrite && (
          <Button onClick={openCreate}>{t("subdivisions.addNew")}</Button>
        )}
      />

      <form onSubmit={handleSearch} className="flex gap-2 items-center mb-4">
        <input
          type="text"
          placeholder={t("subdivisions.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input flex-1"
        />
        <Button type="submit" size="sm">{t("common.search")}</Button>
        {search && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            {t("common.clear")}
          </Button>
        )}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? (
            <div className="col-span-full py-10 text-center text-sm text-bluegray-400">
              {t("common.loading")}
            </div>
          )
          : subdivisions.length === 0
          ? (
            <div className="col-span-full">
              <EmptyState
                title={search
                  ? t("subdivisions.emptySearch")
                  : t("subdivisions.emptyList")}
              />
            </div>
          )
          : (
            subdivisions.map((s) => {
              const head = s.members.find((m) => m.employee_name)?.employee_name;
              return (
                <div key={s.id} className="kpi-card flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-bluegray-900 font-semibold text-base truncate">
                        {s.name}
                      </h3>
                      {head && (
                        <div className="text-bluegray-500 text-sm truncate">
                          {head}
                        </div>
                      )}
                      {s.description && (
                        <div className="text-bluegray-400 text-xs mt-1 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="kpi-value">{s.members.length}</div>
                    <div className="text-bluegray-500 text-xs">
                      {t("subdivisions.memberCount", "xodimlar")}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-bluegray-100">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => openMembers(s)}
                      title={t("subdivisions.members")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </button>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(s)}
                          disabled={deletingId !== null}
                          title={t("common.edit")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => handleDelete(s)}
                          disabled={deletingId !== null}
                          title={t("common.delete")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 mt-4 text-sm text-bluegray-500">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
          >
            &larr; {t("common.previous")}
          </Button>
          <span className="text-xs">
            {t("common.pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
          >
            {t("common.next")} &rarr;
          </Button>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={canWrite && showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateName("");
          setCreateDesc("");
          setCreateMembers([]);
          setCreateErrors({});
        }}
        title={t("subdivisions.addNew")}
      >
        <form
          onSubmit={handleCreate}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="field">
            <label className="field-label">
              {t("subdivisions.nameLabel")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder={t("subdivisions.namePlaceholder")}
              value={createName}
              onChange={(e) => {
                setCreateName(e.target.value);
                setCreateErrors((er) => {
                  const { name: _n, ...rest } = er;
                  return rest;
                });
              }}
              className={`input ${createErrors.name ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
              autoFocus
            />
            <p className="text-xs text-red-600 min-h-4">
              {createErrors.name ?? " "}
            </p>
          </div>
          <div className="field">
            <label className="field-label">
              {t("subdivisions.descriptionLabel")}
            </label>
            <textarea
              placeholder={t("subdivisions.descriptionPlaceholder")}
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              className="input resize-y min-h-16 font-sans"
              disabled={createSubmitting}
              rows={2}
            />
          </div>
          <div className="field">
            <label className="field-label">
              {t("subdivisions.members")}
            </label>
            {createMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {createMembers.map((m) => (
                  <span
                    key={m.value}
                    className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 text-xs font-medium px-2 py-1 rounded-lg"
                  >
                    {m.label}
                    <button
                      type="button"
                      onClick={() =>
                        setCreateMembers((prev) =>
                          prev.filter((x) => x.value !== m.value)
                        )}
                      className="text-cyan-400 hover:text-cyan-700 cursor-pointer"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <AsyncSelect
              value=""
              onChange={(v, opt) => {
                if (
                  v !== "" && opt && !createMembers.some((m) => m.value === v)
                ) setCreateMembers((prev) => [...prev, opt]);
              }}
              fetchOptions={async (search) => {
                const opts = await fetchEmployeeOptions(search);
                return opts.filter((o) => !createMembers.some((m) => m.value === o.value));
              }}
              placeholder={t("subdivisions.selectEmployee")}
              className="input"
              clearable={false}
              disabled={createSubmitting}
            />
          </div>
          {createErrors.api && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {createErrors.api}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setCreateName("");
                setCreateDesc("");
                setCreateMembers([]);
                setCreateErrors({});
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createSubmitting}>
              {createSubmitting
                ? t("subdivisions.creating")
                : t("subdivisions.create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={canWrite && editingSub !== null}
        onClose={() => {
          setEditingSub(null);
          setEditError(null);
        }}
        title={editingSub ? editingSub.name : t("common.edit")}
      >
        <div className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label">
              {t("subdivisions.nameLabel")}
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input"
              disabled={editSubmitting}
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label">
              {t("subdivisions.descriptionLabel")}
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="input resize-y min-h-16 font-sans"
              disabled={editSubmitting}
              rows={2}
            />
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingSub(null);
                setEditError(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={editSubmitting}>
              {editSubmitting ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Members modal */}
      <Modal
        open={membersSub !== null}
        onClose={() => {
          setMembersSub(null);
          setAddEmployeeId("");
          setAddEmployeeName("");
          setMemberErrors({});
        }}
        title={membersSub
          ? t("subdivisions.membersTitle", { name: membersSub.name })
          : ""}
      >
        <div className="flex flex-col gap-4">
          {membersLoading
            ? (
              <div className="py-6 text-center text-sm text-bluegray-400">
                {t("common.loading")}
              </div>
            )
            : membersSub && membersSub.members.length === 0
            ? (
              <div className="py-6 text-center text-sm text-bluegray-400">
                {t("subdivisions.noMembers")}
              </div>
            )
            : membersSub && (
              <div className="border border-bluegray-200 rounded-xl overflow-hidden">
                {membersSub.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-bluegray-100 last:border-b-0"
                  >
                    <span className="text-sm text-bluegray-700">
                      {m.employee_name ?? `#${m.employee_id}`}
                    </span>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        disabled={removingId === m.id}
                        className="icon-btn icon-btn-danger"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          {memberErrors.api && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {memberErrors.api}
            </p>
          )}
          {canWrite && (
            <div className="field">
              <label className="field-label">
                {t("subdivisions.selectEmployee")}
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <AsyncSelect
                    value={addEmployeeId}
                    onChange={(v) => {
                      setAddEmployeeId(v);
                      setAddEmployeeName("");
                    }}
                    fetchOptions={fetchEmployeeOptions}
                    placeholder={t("subdivisions.selectEmployee")}
                    displayValue={addEmployeeName || undefined}
                    className="input"
                  />
                </div>
                <Button
                  onClick={handleAddMember}
                  disabled={addingMember || addEmployeeId === ""}
                >
                  {addingMember
                    ? t("subdivisions.adding")
                    : t("subdivisions.addMember")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
