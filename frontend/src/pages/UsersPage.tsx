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
  FilterChip,
  ListCard,
  ListRow,
  EmptyState,
  StatusPill,
  initials,
  type StatusVariant,
} from "../components/ui";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function roleLabel(role: string, t: any): string {
  if (role === "master_admin") return t("users.roleMasterAdmin");
  if (role === "admin") return t("users.roleAdmin");
  if (role === "hr") return t("users.roleHr", "HR");
  return t("users.roleEmployee");
}

function roleVariant(role: string): StatusVariant {
  if (role === "master_admin" || role === "admin") return "info";
  return "neutral";
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
  const canWriteUsers = canWrite;
  const isMasterAdmin = user?.role === "master_admin";

  // List state
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [, setTotal] = useState(0);
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

  // Deleting / status toggling
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listUsers(page, 10, search || undefined, roleFilter || undefined);
      setUsers(result.items);
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

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  function openCreate() {
    setShowCreateModal(true);
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
    if (!canWrite) return;
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

  async function handleToggleStatus(u: UserResponse) {
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
      <div className="field">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={e => setUseCustom(e.target.checked)}
            disabled={disabled}
          />
          <span className="field-label" style={{ marginBottom: 0 }}>{t("users.customPermissions")}</span>
        </label>
        {useCustom && (
          <div className="border border-bluegray-200 rounded-xl p-3 mt-2 space-y-3 max-h-64 overflow-y-auto">
            <label className="flex items-center gap-2 cursor-pointer border-b border-bluegray-100 pb-2">
              <input
                type="checkbox"
                checked={perms.size === ALL_PERMISSIONS.length}
                onChange={e => toggleAll(setter, e.target.checked)}
                disabled={disabled}
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

  if (!canRead) {
    return (
      <div>
        <PageHead title={t("users.title")} subtitle={t("users.subtitle")} />
        <EmptyState title={t("common.noAccess")} />
      </div>
    );
  }

  const roleChips: { value: string; label: string }[] = [
    { value: "", label: t("users.allRoles") },
    { value: "master_admin", label: t("users.roleMasterAdmin") },
    { value: "admin", label: t("users.roleAdmin") },
    { value: "hr", label: t("users.roleHr", "HR") },
    { value: "employee", label: t("users.roleEmployee") },
  ];

  return (
    <div>
      <PageHead
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={canWriteUsers && isMasterAdmin && <Button onClick={openCreate}>{t("users.addNew")}</Button>}
      />

      <div className="mb-3">
        <Searchbar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("users.searchPlaceholder")}
        />
      </div>

      <div className="chip-row">
        {roleChips.map((c) => (
          <FilterChip
            key={c.value || "all"}
            active={roleFilter === c.value}
            onClick={() => { setRoleFilter(c.value); setPage(1); }}
          >
            {c.label}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
      ) : users.length === 0 ? (
        <EmptyState
          title={search || roleFilter ? t("users.emptySearch") : t("users.emptyList")}
        />
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden">
            <ListCard>
              {users.map((u) => (
                <ListRow
                  key={u.id}
                  avatar={
                    <div
                      className="flex items-center justify-center w-full h-full rounded-full text-sm font-semibold"
                      style={{ background: "var(--brand-50, #ecfeff)", color: "var(--brand-700, #0e7490)" }}
                    >
                      {initials(u.display_name)}
                    </div>
                  }
                  title={
                    <span>
                      {u.display_name}
                      {u.must_change_password && (
                        <span className="ml-2 text-[10px] text-amber-600 font-medium">{t("users.mustChangePw")}</span>
                      )}
                    </span>
                  }
                  subtitle={
                    <span className="flex items-center gap-2 flex-wrap">
                      <span>@{u.username}</span>
                      <span>·</span>
                      <StatusPill variant={roleVariant(u.role)}>{roleLabel(u.role, t)}</StatusPill>
                    </span>
                  }
                  metric={{
                    value: (
                      <StatusPill variant={u.is_active ? "success" : "neutral"}>
                        {u.is_active ? t("users.active") : t("users.inactive")}
                      </StatusPill>
                    ),
                  }}
                  onClick={canWrite ? () => startEdit(u) : undefined}
                />
              ))}
            </ListCard>
          </div>

          {/* Desktop table */}
          <ListCard className="hidden md:block overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("users.nameLabel")}</th>
                  <th>{t("users.usernameLabel")}</th>
                  <th>{t("users.roleLabel")}</th>
                  <th>{t("users.lastLogin")}</th>
                  <th>{t("common.status")}</th>
                  {canWrite && <th>{t("common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold"
                          style={{ background: "var(--brand-50, #ecfeff)", color: "var(--brand-700, #0e7490)" }}
                        >
                          {initials(u.display_name)}
                        </div>
                        <div>
                          <div>{u.display_name}</div>
                          {u.must_change_password && (
                            <span className="text-[10px] text-amber-600 font-medium">{t("users.mustChangePw")}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{u.username}</td>
                    <td>
                      <StatusPill variant={roleVariant(u.role)}>{roleLabel(u.role, t)}</StatusPill>
                    </td>
                    <td>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : t("users.never")}
                    </td>
                    <td>
                      <StatusPill variant={u.is_active ? "success" : "neutral"}>
                        {u.is_active ? t("users.active") : t("users.inactive")}
                      </StatusPill>
                    </td>
                    {canWrite && (
                      <td>
                        <div className="flex gap-1 items-center">
                          <Button variant="warn" size="sm" onClick={() => startEdit(u)} disabled={deletingId !== null}>
                            {t("common.edit")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setResetUser(u); setNewPassword(""); }} disabled={deletingId !== null}>
                            {t("users.resetPassword")}
                          </Button>
                          {u.role !== "master_admin" && (
                            <Button
                              variant={u.is_active ? "danger" : "success"}
                              size="sm"
                              onClick={() => handleToggleStatus(u)}
                              disabled={deletingId !== null}
                            >
                              {u.is_active ? t("users.inactive") : t("users.active")}
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </ListCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-3 text-sm text-bluegray-500">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                {t("common.previous")}
              </Button>
              <span className="text-xs">{t("common.pageOf", { page, total: totalPages })}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}

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
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-3">
          <div className="field">
            <label className="field-label">{t("users.nameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("users.namePlaceholder")}
              value={createState.display_name}
              onChange={(e) => { setCreateState((s) => ({ ...s, display_name: e.target.value })); setCreateErrors(prev => { const n = {...prev}; delete n.display_name; return n; }); }}
              className={`input ${createErrors.display_name ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
              autoFocus
            />
            {createErrors.display_name && <p className="text-xs text-red-600 mt-1">{createErrors.display_name}</p>}
          </div>
          <div className="field">
            <label className="field-label">{t("users.usernameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("users.usernamePlaceholder")}
              value={createState.username}
              onChange={(e) => { setCreateState((s) => ({ ...s, username: e.target.value })); setCreateErrors(prev => { const n = {...prev}; delete n.username; return n; }); }}
              className={`input ${createErrors.username ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
            />
            {createErrors.username && <p className="text-xs text-red-600 mt-1">{createErrors.username}</p>}
          </div>
          <div className="field">
            <label className="field-label">{t("users.passwordLabel")} <span className="text-red-400">*</span></label>
            <input
              type="password"
              placeholder={t("users.passwordPlaceholder")}
              value={createState.password}
              onChange={(e) => { setCreateState((s) => ({ ...s, password: e.target.value })); setCreateErrors(prev => { const n = {...prev}; delete n.password; return n; }); }}
              className={`input ${createErrors.password ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
            />
            {createErrors.password && <p className="text-xs text-red-600 mt-1">{createErrors.password}</p>}
          </div>
          <div className="field">
            <label className="field-label">{t("users.roleLabel")}</label>
            <select
              value={createState.role}
              onChange={(e) => setCreateState((s) => ({ ...s, role: e.target.value }))}
              className="input"
              disabled={createSubmitting}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t("users.emailLabel")}</label>
            <input
              type="email"
              placeholder={t("users.emailPlaceholder")}
              value={createState.email}
              onChange={(e) => setCreateState((s) => ({ ...s, email: e.target.value }))}
              className="input"
              disabled={createSubmitting}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("users.phoneLabel")}</label>
            <input
              type="tel"
              value={createState.phone_number}
              onChange={(e) => setCreateState((s) => ({ ...s, phone_number: e.target.value }))}
              className="input"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setCreateErrors({});
                setCreateState({ display_name: "", username: "", password: "", role: "employee", email: "", phone_number: "", useCustomPerms: false, permissions: new Set() });
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createSubmitting}>
              {createSubmitting ? t("users.creating") : t("users.create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={canWrite && editingUser !== null}
        onClose={() => { setEditingUser(null); setEditError(null); }}
        title={editingUser ? editingUser.display_name : t("common.edit")}
      >
        <div className="flex flex-col gap-3">
          <div className="field">
            <label className="field-label">{t("users.nameLabel")}</label>
            <input
              type="text"
              value={editState.display_name}
              onChange={(e) => setEditState((s) => ({ ...s, display_name: e.target.value }))}
              className="input"
              disabled={editSubmitting}
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label">{t("users.roleLabel")}</label>
            <select
              value={editState.role}
              onChange={(e) => setEditState((s) => ({ ...s, role: e.target.value }))}
              className="input"
              disabled={editSubmitting}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t("users.emailLabel")}</label>
            <input
              type="email"
              placeholder={t("users.emailPlaceholder")}
              value={editState.email}
              onChange={(e) => setEditState((s) => ({ ...s, email: e.target.value }))}
              className="input"
              disabled={editSubmitting}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("users.phoneLabel")}</label>
            <input
              type="tel"
              value={editState.phone_number}
              onChange={(e) => setEditState((s) => ({ ...s, phone_number: e.target.value }))}
              className="input"
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
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            {editingUser && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { if (editingUser) { setResetUser(editingUser); setNewPassword(""); setEditingUser(null); } }}
                >
                  {t("users.resetPassword")}
                </Button>
                {editingUser.role !== "master_admin" && (
                  <Button
                    type="button"
                    variant={editingUser.is_active ? "danger" : "outline"}
                    size="sm"
                    onClick={() => { const u = editingUser; setEditingUser(null); handleToggleStatus(u); }}
                  >
                    {editingUser.is_active ? t("users.inactive") : t("users.active")}
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditingUser(null); setEditError(null); }}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleUpdate} disabled={editSubmitting}>
                {editSubmitting ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={resetUser !== null}
        onClose={() => { setResetUser(null); setNewPassword(""); setResetErrors({}); }}
        title={resetUser ? t("users.resetPasswordTitle", { name: resetUser.display_name }) : ""}
      >
        <form onSubmit={handleResetPassword} noValidate className="flex flex-col gap-3">
          <div className="field">
            <label className="field-label">{t("users.newPasswordLabel")} <span className="text-red-400">*</span></label>
            <input
              type="password"
              placeholder={t("users.passwordPlaceholder")}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setResetErrors(prev => { const n = {...prev}; delete n.password; return n; }); }}
              className={`input ${resetErrors.password ? "!border-red-400" : ""}`}
              disabled={resetSubmitting}
              autoFocus
            />
            {resetErrors.password && <p className="text-xs text-red-600 mt-1">{resetErrors.password}</p>}
          </div>
          {resetErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{resetErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setResetUser(null); setNewPassword(""); setResetErrors({}); }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={resetSubmitting || !newPassword}>
              {resetSubmitting ? t("users.resetting") : t("users.resetPassword")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
