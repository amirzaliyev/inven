import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
} from "../api/users";
import type { UserResponse } from "../types";

const ROLES = ["employee", "admin"] as const;

const PERMISSION_GROUPS: { group: string; permissions: string[] }[] = [
  { group: "employees", permissions: ["employees:read", "employees:write", "employees:delete"] },
  { group: "payroll", permissions: ["payroll:read", "payroll:generate", "payroll:approve"] },
  { group: "orders", permissions: ["orders:read", "orders:write", "orders:complete"] },
  { group: "batches", permissions: ["batches:read", "batches:write"] },
  { group: "inventory", permissions: ["inventory:read", "inventory:write"] },
  { group: "products", permissions: ["products:read", "products:write"] },
  { group: "customers", permissions: ["customers:read", "customers:write"] },
  { group: "users", permissions: ["users:read", "users:write"] },
  { group: "dashboard", permissions: ["dashboard:view"] },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions);

function roleBadge(role: string) {
  if (role === "master_admin" || role === "admin") {
    return "bg-cyan-100 text-cyan-700";
  }
  return "bg-bluegray-100 text-bluegray-600";
}

function roleLabel(role: string, t: (k: string) => string) {
  if (role === "master_admin") return t("users.roleMasterAdmin");
  if (role === "admin") return t("users.roleAdmin");
  return t("users.roleEmployee");
}

interface CreateState {
  display_name: string;
  username: string;
  password: string;
  role: string;
  email: string;
  phone_number: string;
  useCustomPerms: boolean;
  permissions: Set<string>;
}

interface EditState {
  display_name: string;
  role: string;
  email: string;
  phone_number: string;
  useCustomPerms: boolean;
  permissions: Set<string>;
}

export default function UsersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission, user } = useAuth();

  const canRead = hasPermission("users:read");
  const canWrite = hasPermission("users:write");
  const isMasterAdmin = user?.role === "master_admin";

  // List state
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createState, setCreateState] = useState<CreateState>({
    display_name: "", username: "", password: "", role: "employee", email: "", phone_number: "",
    useCustomPerms: false, permissions: new Set(),
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editState, setEditState] = useState<EditState>({
    display_name: "", role: "employee", email: "", phone_number: "",
    useCustomPerms: false, permissions: new Set(),
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserResponse | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  // Deleting
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listUsers(page, 10, search || undefined, roleFilter || undefined);
      setUsers(result.items);
      // UserList doesn't have pages, compute it
      const pages = Math.max(1, Math.ceil(result.total / result.size));
      setTotalPages(pages);
      setTotal(result.total);
    } catch {
      toast("error", t("users.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, t]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!createState.display_name.trim()) errs.display_name = t("users.validationRequired");
    if (!createState.username.trim()) errs.username = t("users.validationRequired");
    if (!createState.password) errs.password = t("users.validationRequired");
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }
    setCreateErrors({});
    setCreateSubmitting(true);
    try {
      const created = await createUser({
        display_name: createState.display_name.trim(),
        username: createState.username.trim(),
        password: createState.password,
        role: createState.role,
        email: createState.email.trim() || null,
        phone_number: createState.phone_number.trim() || null,
        permissions: createState.useCustomPerms ? [...createState.permissions] : null,
      });
      toast("success", t("users.createSuccess", { name: created.display_name }));
      setShowCreateModal(false);
      setCreateState({ display_name: "", username: "", password: "", role: "employee", email: "", phone_number: "", useCustomPerms: false, permissions: new Set() });
      fetchUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("users.createError");
      setCreateErrors({ api: msg });
    } finally {
      setCreateSubmitting(false);
    }
  }

  function startEdit(u: UserResponse) {
    setEditingUser(u);
    const hasCustom = u.custom_permissions.length > 0;
    setEditState({
      display_name: u.display_name,
      role: u.role,
      email: u.email ?? "",
      phone_number: u.phone_number ?? "",
      useCustomPerms: hasCustom,
      permissions: new Set(u.custom_permissions.map(p => p.permission)),
    });
    setEditError(null);
  }

  async function handleUpdate() {
    if (!editingUser) return;
    if (!editState.display_name.trim()) {
      setEditError(t("users.validationRequired"));
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateUser(editingUser.id, {
        display_name: editState.display_name.trim(),
        role: editState.role,
        email: editState.email.trim() || null,
        phone_number: editState.phone_number.trim() || null,
        permissions: editState.useCustomPerms ? [...editState.permissions] : null,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast("success", t("users.updateSuccess"));
      setEditingUser(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("users.updateError");
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(u: UserResponse) {
    const ok = await confirm({
      message: t("users.deleteConfirm", { name: u.display_name }),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      toast("success", t("users.deleteSuccess"));
      await fetchUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("users.deleteError");
      toast("error", msg);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    if (!newPassword) { setResetErrors({ password: t("users.validationRequired") }); return; }
    if (newPassword.length < 8) { setResetErrors({ password: t("users.passwordMinLength") }); return; }
    setResetErrors({});
    setResetSubmitting(true);
    try {
      await resetPassword(resetUser.id, { new_password: newPassword });
      toast("success", t("users.resetPasswordSuccess"));
      setResetUser(null);
      setNewPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("users.resetPasswordError");
      setResetErrors({ api: msg });
    } finally {
      setResetSubmitting(false);
    }
  }

  function togglePerm(setter: React.Dispatch<React.SetStateAction<CreateState>> | React.Dispatch<React.SetStateAction<EditState>>, perm: string) {
    (setter as React.Dispatch<React.SetStateAction<CreateState | EditState>>)(prev => {
      const next = new Set(prev.permissions);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return { ...prev, permissions: next };
    });
  }

  function toggleGroupAll(setter: React.Dispatch<React.SetStateAction<CreateState>> | React.Dispatch<React.SetStateAction<EditState>>, perms: string[], checked: boolean) {
    (setter as React.Dispatch<React.SetStateAction<CreateState | EditState>>)(prev => {
      const next = new Set(prev.permissions);
      perms.forEach(p => checked ? next.add(p) : next.delete(p));
      return { ...prev, permissions: next };
    });
  }

  function toggleAll(setter: React.Dispatch<React.SetStateAction<CreateState>> | React.Dispatch<React.SetStateAction<EditState>>, checked: boolean) {
    (setter as React.Dispatch<React.SetStateAction<CreateState | EditState>>)(prev => ({
      ...prev,
      permissions: checked ? new Set(ALL_PERMISSIONS) : new Set(),
    }));
  }

  function renderPermissionsEditor(
    perms: Set<string>,
    setter: React.Dispatch<React.SetStateAction<CreateState>> | React.Dispatch<React.SetStateAction<EditState>>,
    useCustom: boolean,
    setUseCustom: (v: boolean) => void,
    disabled: boolean,
  ) {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={e => setUseCustom(e.target.checked)}
            disabled={disabled}
            className="accent-cyan-500"
          />
          <span className="text-sm font-medium text-bluegray-600">{t("users.customPermissions")}</span>
        </label>
        {useCustom && (
          <div className="border border-bluegray-200 rounded-xl p-3 space-y-3 max-h-56 overflow-y-auto">
            <label className="flex items-center gap-2 cursor-pointer border-b border-bluegray-100 pb-2">
              <input
                type="checkbox"
                checked={perms.size === ALL_PERMISSIONS.length}
                onChange={e => toggleAll(setter, e.target.checked)}
                disabled={disabled}
                className="accent-cyan-500"
              />
              <span className="text-xs font-semibold text-bluegray-700">{t("users.selectAll")}</span>
            </label>
            {PERMISSION_GROUPS.map(g => {
              const allChecked = g.permissions.every(p => perms.has(p));
              const someChecked = g.permissions.some(p => perms.has(p));
              return (
                <div key={g.group}>
                  <label className="flex items-center gap-2 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={e => toggleGroupAll(setter, g.permissions, e.target.checked)}
                      disabled={disabled}
                      className="accent-cyan-500"
                    />
                    <span className="text-xs font-semibold text-bluegray-600 uppercase tracking-wider">{t(`users.permGroup.${g.group}`, g.group)}</span>
                  </label>
                  <div className="ml-5 flex flex-wrap gap-x-4 gap-y-1">
                    {g.permissions.map(p => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perms.has(p)}
                          onChange={() => togglePerm(setter, p)}
                          disabled={disabled}
                          className="accent-cyan-500"
                        />
                        <span className="text-xs text-bluegray-600">{p.split(":")[1]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const inputCls =
    "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  if (!canRead) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("users.title")}</h1>
        <div className="mt-8 bg-white rounded-2xl shadow px-6 py-12 text-center">
          <svg className="w-12 h-12 text-bluegray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-medium text-bluegray-500">{t("common.noAccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("users.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-6">{t("users.subtitle")}</p>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("users.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{total}</span>
          </div>
          {isMasterAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              + {t("users.addNew")}
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-3">
          <form onSubmit={handleSearch} className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              placeholder={t("users.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`flex-1 min-w-0 ${inputCls}`}
            />
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className={inputCls}
            >
              <option value="">{t("users.allRoles")}</option>
              <option value="admin">{t("users.roleAdmin")}</option>
              <option value="employee">{t("users.roleEmployee")}</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-colors"
            >
              {t("common.search")}
            </button>
            {(search || roleFilter) && (
              <button
                type="button"
                className="px-3 py-2 text-bluegray-500 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
                onClick={() => { setSearchInput(""); setSearch(""); setRoleFilter(""); setPage(1); }}
              >
                {t("common.clear")}
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : users.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">
            {search || roleFilter ? t("users.emptySearch") : t("users.emptyList")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("users.nameLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("users.usernameLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("users.roleLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.status")}</th>
                    <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("users.lastLogin")}</th>
                    {canWrite && (
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-3 text-left w-28">{t("common.actions")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-bluegray-50">
                      <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        <span className="text-bluegray-400 text-xs">#{u.id}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        <div>{u.display_name}</div>
                        {u.must_change_password && (
                          <span className="text-[10px] text-amber-600 font-medium">{t("users.mustChangePw")}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-bluegray-500 border-b border-bluegray-100">
                        {u.username}
                      </td>
                      <td className="px-5 py-3 border-b border-bluegray-100">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge(u.role)}`}>
                          {roleLabel(u.role, t)}
                        </span>
                      </td>
                      <td className="px-5 py-3 border-b border-bluegray-100">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {u.is_active ? t("users.active") : t("users.inactive")}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-400 border-b border-bluegray-100">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : t("users.never")}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 border-b border-bluegray-100">
                          <div className="flex gap-1.5 items-center">
                            <button
                              onClick={() => startEdit(u)}
                              disabled={deletingId !== null}
                              title={t("common.edit")}
                              className="p-1.5 text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50 cursor-pointer disabled:opacity-40"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setResetUser(u); setNewPassword(""); }}
                              disabled={deletingId !== null}
                              title={t("users.resetPassword")}
                              className="p-1.5 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 cursor-pointer disabled:opacity-40"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                            {u.role !== "master_admin" && (
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={deletingId !== null}
                              title={t("common.delete")}
                              className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-40"
                            >
                              {deletingId === u.id
                                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              }
                            </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`}
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  <span className="sm:hidden">←</span>
                  <span className="hidden sm:inline">← {t("common.previous")}</span>
                </button>
                <span className="text-xs">{t("common.pageOf", { page, total: totalPages })}</span>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page >= totalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`}
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
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
      <Modal
        open={isMasterAdmin && showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateErrors({});
          setCreateState({ display_name: "", username: "", password: "", role: "employee", email: "", phone_number: "", useCustomPerms: false, permissions: new Set() });
        }}
        title={t("users.addNew")}
      >
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.nameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("users.namePlaceholder")}
              value={createState.display_name}
              onChange={(e) => { setCreateState((s) => ({ ...s, display_name: e.target.value })); setCreateErrors(prev => { const n = {...prev}; delete n.display_name; return n; }); }}
              className={`${inputCls} ${createErrors.display_name ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
              autoFocus
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.display_name ?? "\u00A0"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.usernameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("users.usernamePlaceholder")}
              value={createState.username}
              onChange={(e) => { setCreateState((s) => ({ ...s, username: e.target.value })); setCreateErrors(prev => { const n = {...prev}; delete n.username; return n; }); }}
              className={`${inputCls} ${createErrors.username ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.username ?? "\u00A0"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.passwordLabel")} <span className="text-red-400">*</span></label>
            <input
              type="password"
              placeholder={t("users.passwordPlaceholder")}
              value={createState.password}
              onChange={(e) => { setCreateState((s) => ({ ...s, password: e.target.value })); setCreateErrors(prev => { const n = {...prev}; delete n.password; return n; }); }}
              className={`${inputCls} ${createErrors.password ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.password ?? "\u00A0"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.roleLabel")}</label>
            <select
              value={createState.role}
              onChange={(e) => setCreateState((s) => ({ ...s, role: e.target.value }))}
              className={inputCls}
              disabled={createSubmitting}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.emailLabel")}</label>
            <input
              type="email"
              placeholder={t("users.emailPlaceholder")}
              value={createState.email}
              onChange={(e) => setCreateState((s) => ({ ...s, email: e.target.value }))}
              className={inputCls}
              disabled={createSubmitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.phoneLabel")}</label>
            <input
              type="tel"
              value={createState.phone_number}
              onChange={(e) => setCreateState((s) => ({ ...s, phone_number: e.target.value }))}
              className={inputCls}
              disabled={createSubmitting}
            />
          </div>
          {renderPermissionsEditor(
            createState.permissions,
            setCreateState,
            createState.useCustomPerms,
            v => setCreateState(s => ({ ...s, useCustomPerms: v, permissions: v ? s.permissions : new Set() })),
            createSubmitting,
          )}
          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setCreateErrors({});
                setCreateState({ display_name: "", username: "", password: "", role: "employee", email: "", phone_number: "", useCustomPerms: false, permissions: new Set() });
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={createSubmitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${createSubmitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}
            >
              {createSubmitting ? t("users.creating") : t("users.create")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={canWrite && editingUser !== null}
        onClose={() => { setEditingUser(null); setEditError(null); }}
        title={editingUser ? editingUser.display_name : t("common.edit")}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.nameLabel")}</label>
            <input
              type="text"
              value={editState.display_name}
              onChange={(e) => setEditState((s) => ({ ...s, display_name: e.target.value }))}
              className={inputCls}
              disabled={editSubmitting}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.roleLabel")}</label>
            <select
              value={editState.role}
              onChange={(e) => setEditState((s) => ({ ...s, role: e.target.value }))}
              className={inputCls}
              disabled={editSubmitting}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.emailLabel")}</label>
            <input
              type="email"
              placeholder={t("users.emailPlaceholder")}
              value={editState.email}
              onChange={(e) => setEditState((s) => ({ ...s, email: e.target.value }))}
              className={inputCls}
              disabled={editSubmitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.phoneLabel")}</label>
            <input
              type="tel"
              value={editState.phone_number}
              onChange={(e) => setEditState((s) => ({ ...s, phone_number: e.target.value }))}
              className={inputCls}
              disabled={editSubmitting}
            />
          </div>
          {renderPermissionsEditor(
            editState.permissions,
            setEditState,
            editState.useCustomPerms,
            v => setEditState(s => ({ ...s, useCustomPerms: v, permissions: v ? s.permissions : new Set() })),
            editSubmitting,
          )}
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setEditingUser(null); setEditError(null); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleUpdate}
              disabled={editSubmitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${editSubmitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}
            >
              {editSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={resetUser !== null}
        onClose={() => { setResetUser(null); setNewPassword(""); setResetErrors({}); }}
        title={resetUser ? t("users.resetPasswordTitle", { name: resetUser.display_name }) : ""}
      >
        <form onSubmit={handleResetPassword} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("users.newPasswordLabel")} <span className="text-red-400">*</span></label>
            <input
              type="password"
              placeholder={t("users.passwordPlaceholder")}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setResetErrors(prev => { const n = {...prev}; delete n.password; return n; }); }}
              className={`${inputCls} ${resetErrors.password ? "!border-red-400" : ""}`}
              disabled={resetSubmitting}
              autoFocus
            />
            <p className="text-xs text-red-600 min-h-4">{resetErrors.password ?? "\u00A0"}</p>
          </div>
          {resetErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{resetErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setResetUser(null); setNewPassword(""); setResetErrors({}); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={resetSubmitting || !newPassword}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${resetSubmitting || !newPassword ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}
            >
              {resetSubmitting ? t("users.resetting") : t("users.resetPassword")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
