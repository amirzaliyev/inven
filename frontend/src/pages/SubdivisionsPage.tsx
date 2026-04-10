import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext.tsx";
import { useConfirm } from "../contexts/ConfirmContext.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import { Modal } from "../components/Modal.tsx";
import { AsyncSelect, type SelectOption } from "../components/AsyncSelect.tsx";
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createEmployeeIds, setCreateEmployeeIds] = useState<number[]>([]);
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
      const result = await listSubdivisions(page, 10, search || undefined);
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
      for (const empId of createEmployeeIds) {
        try {
          await addMember(created.id, { employee_id: empId });
        } catch { /* skip duplicates */ }
      }
      toast("success", t("subdivisions.createSuccess", { name: created.name }));
      setCreateName("");
      setCreateDesc("");
      setCreateEmployeeIds([]);
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

  const inputCls =
    "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  if (!canRead) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">
          {t("subdivisions.title")}
        </h1>
        <div className="mt-8 bg-white rounded-2xl shadow px-6 py-12 text-center">
          <svg
            className="w-12 h-12 text-bluegray-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm font-medium text-bluegray-500">
            {t("common.noAccess")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">
        {t("subdivisions.title")}
      </h1>
      <p className="text-sm text-bluegray-400 mb-6">
        {t("subdivisions.subtitle")}
      </p>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">
              {t("subdivisions.listTitle")}
            </span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {total}
            </span>
          </div>
          {canWrite && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              + {t("subdivisions.addNew")}
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-3">
          <form onSubmit={handleSearch} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder={t("subdivisions.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`flex-1 ${inputCls}`}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            >
              {t("common.search")}
            </button>
            {search && (
              <button
                type="button"
                className="px-3 py-2 text-bluegray-500 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
              >
                {t("common.clear")}
              </button>
            )}
          </form>
        </div>

        {loading
          ? (
            <div className="px-5 py-10 text-center text-sm text-bluegray-400">
              {t("common.loading")}
            </div>
          )
          : subdivisions.length === 0
          ? (
            <div className="px-5 py-10 text-center text-sm text-bluegray-400">
              {search
                ? t("subdivisions.emptySearch")
                : t("subdivisions.emptyList")}
            </div>
          )
          : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">
                        {t("common.id")}
                      </th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">
                        {t("common.name")}
                      </th>
                      <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">
                        {t("subdivisions.descriptionLabel")}
                      </th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">
                        {t("subdivisions.memberCount")}
                      </th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-3 text-left w-28">
                        {t("common.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subdivisions.map((s) => (
                      <tr key={s.id} className="hover:bg-bluegray-50">
                        <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                          <span className="text-bluegray-400 text-xs">
                            #{s.id}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                          {s.name}
                        </td>
                        <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-400 border-b border-bluegray-100">
                          {s.description ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                          <span className="bg-bluegray-100 text-bluegray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {s.members.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-bluegray-100">
                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={() =>
                                openMembers(s)}
                              title={t("subdivisions.members")}
                              className="p-1.5 text-bluegray-600 border border-bluegray-200 rounded-lg hover:bg-bluegray-50 cursor-pointer disabled:opacity-40"
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
                                  onClick={() => startEdit(s)}
                                  disabled={deletingId !== null}
                                  title={t("common.edit")}
                                  className="p-1.5 text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50 cursor-pointer disabled:opacity-40"
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
                                  onClick={() =>
                                    handleDelete(s)}
                                  disabled={deletingId !== null}
                                  title={t("common.delete")}
                                  className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-40"
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
                  <button
                    className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                      page <= 1
                        ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed"
                        : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
                    }`}
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                  >
                    <span className="sm:hidden">&larr;</span>
                    <span className="hidden sm:inline">
                      &larr; {t("common.previous")}
                    </span>
                  </button>
                  <span className="text-xs">
                    {t("common.pageOf", { page, total: totalPages })}
                  </span>
                  <button
                    className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                      page >= totalPages
                        ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed"
                        : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
                    }`}
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                  >
                    <span className="sm:hidden">&rarr;</span>
                    <span className="hidden sm:inline">
                      {t("common.next")} &rarr;
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
      </div>

      {/* Create modal */}
      <Modal
        open={canWrite && showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateName("");
          setCreateDesc("");
          setCreateEmployeeIds([]);
          setCreateErrors({});
        }}
        title={t("subdivisions.addNew")}
      >
        <form
          onSubmit={handleCreate}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">
              {t("subdivisions.nameLabel")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder={t("subdivisions.namePlaceholder")}
              value={createName}
              onChange={(e) => {
                setCreateName(e.target.value);
                setCreateErrors((er) => {
                  const { name, ...rest } = er;
                  return rest;
                });
              }}
              className={`${inputCls} ${
                createErrors.name ? "!border-red-400" : ""
              }`}
              disabled={createSubmitting}
              autoFocus
            />
            <p className="text-xs text-red-600 min-h-4">
              {createErrors.name ?? "\u00A0"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">
              {t("subdivisions.descriptionLabel")}
            </label>
            <textarea
              placeholder={t("subdivisions.descriptionPlaceholder")}
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              className={`${inputCls} resize-y min-h-16 font-sans`}
              disabled={createSubmitting}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">
              {t("subdivisions.members")}
            </label>
            {createEmployeeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {createEmployeeIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 text-xs font-medium px-2 py-1 rounded-lg"
                  >
                    #{id}
                    <button
                      type="button"
                      onClick={() =>
                        setCreateEmployeeIds((prev) =>
                          prev.filter((x) => x !== id)
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
              onChange={(v) => {
                if (
                  v !== "" && !createEmployeeIds.includes(v)
                ) setCreateEmployeeIds((prev) => [...prev, v]);
              }}
              fetchOptions={async (search) => {
                const opts = await fetchEmployeeOptions(search);
                return opts.filter((o) => !createEmployeeIds.includes(o.value));
              }}
              placeholder={t("subdivisions.selectEmployee")}
              className={inputCls}
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
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setCreateName("");
                setCreateDesc("");
                setCreateEmployeeIds([]);
                setCreateErrors({});
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={createSubmitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${
                createSubmitting
                  ? "bg-cyan-300 cursor-not-allowed"
                  : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"
              }`}
            >
              {createSubmitting
                ? t("subdivisions.creating")
                : t("subdivisions.create")}
            </button>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">
              {t("subdivisions.nameLabel")}
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputCls}
              disabled={editSubmitting}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">
              {t("subdivisions.descriptionLabel")}
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className={`${inputCls} resize-y min-h-16 font-sans`}
              disabled={editSubmitting}
              rows={2}
            />
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEditingSub(null);
                setEditError(null);
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleUpdate}
              disabled={editSubmitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${
                editSubmitting
                  ? "bg-cyan-300 cursor-not-allowed"
                  : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"
              }`}
            >
              {editSubmitting ? t("common.saving") : t("common.save")}
            </button>
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
                        onClick={() => handleRemoveMember(m)}
                        disabled={removingId === m.id}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-40"
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
            <div>
              <label className="text-sm font-medium text-bluegray-600 mb-1.5 block">
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
                    className={inputCls}
                  />
                </div>
                <button
                  onClick={handleAddMember}
                  disabled={addingMember || addEmployeeId === ""}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold text-white whitespace-nowrap ${
                    addingMember || addEmployeeId === ""
                      ? "bg-cyan-300 cursor-not-allowed"
                      : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"
                  }`}
                >
                  {addingMember
                    ? t("subdivisions.adding")
                    : t("subdivisions.addMember")}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
