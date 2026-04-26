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
  StatusPill,
  initials,
  fmtMoney,
} from "../components/ui";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  attachUserToEmployee,
} from "../api/employees";
import type { Employee, EmploymentType } from "../types";

const ROLES = ["employee", "admin"] as const;

function roleLabel(role: string, t: (k: string) => string) {
  if (role === "master_admin") return t("users.roleMasterAdmin");
  if (role === "admin") return t("users.roleAdmin");
  return t("users.roleEmployee");
}

function salaryNum(salary: string | number | null | undefined): string {
  if (salary === null || salary === undefined) return "—";
  const n = typeof salary === "string" ? parseFloat(salary) : salary;
  if (isNaN(n)) return "—";
  return fmtMoney(n);
}

interface CreateState {
  employee_number: string;
  full_name: string;
  position: string;
  department: string;
  phone_number: string;
  base_salary: string;
  employment_type: EmploymentType;
  hired_at: string;
  createUser: boolean;
  username: string;
  password: string;
  role: string;
}

interface EditState {
  full_name: string;
  position: string;
  department: string;
  phone_number: string;
  base_salary: string;
  employment_type: EmploymentType;
  terminated_at: string;
}

interface AttachState {
  username: string;
  password: string;
  role: string;
}

const EMPTY_CREATE: CreateState = {
  employee_number: "", full_name: "", position: "", department: "",
  phone_number: "", base_salary: "", employment_type: "SALARY", hired_at: "",
  createUser: false, username: "", password: "", role: "employee",
};

export default function EmployeesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();

  const canRead = hasPermission("employees:read");
  const canWriteEmployees = hasPermission("employees:write");
  const canDelete = hasPermission("employees:delete");

  // List state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createState, setCreateState] = useState<CreateState>(EMPTY_CREATE);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Edit modal
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editState, setEditState] = useState<EditState>({
    full_name: "", position: "", department: "", phone_number: "",
    base_salary: "", employment_type: "SALARY", terminated_at: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Attach user modal
  const [attachEmployee, setAttachEmployee] = useState<Employee | null>(null);
  const [attachState, setAttachState] = useState<AttachState>({ username: "", password: "", role: "employee" });
  const [attachSubmitting, setAttachSubmitting] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  // Deleting
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listEmployees(page, 10, search || undefined);
      setEmployees(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch {
      toast("error", t("employees.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // debounce search input
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  function openCreate() {
    setCreateState(EMPTY_CREATE);
    setCreateErrors({});
    setShowCreateModal(true);
  }

  function closeCreate() {
    setShowCreateModal(false);
    setCreateErrors({});
    setCreateState(EMPTY_CREATE);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const isSalary = createState.employment_type === "SALARY";
    const errs: Record<string, string> = {};
    if (!createState.employee_number.trim()) errs.employee_number = t("employees.validationRequired");
    if (!createState.full_name.trim()) errs.full_name = t("employees.validationRequired");
    if (!createState.position.trim()) errs.position = t("employees.validationRequired");
    if (isSalary && !createState.base_salary) errs.base_salary = t("employees.validationRequired");
    if (!createState.hired_at) errs.hired_at = t("employees.validationRequired");
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }
    setCreateErrors({});
    setCreateSubmitting(true);
    try {
      const payload: Parameters<typeof createEmployee>[0] = {
        employee_number: createState.employee_number.trim(),
        full_name: createState.full_name.trim(),
        position: createState.position.trim(),
        department: createState.department.trim() || null,
        phone_number: createState.phone_number.trim() || null,
        base_salary: isSalary && createState.base_salary ? parseFloat(createState.base_salary) : null,
        employment_type: createState.employment_type,
        hired_at: createState.hired_at,
      };
      if (createState.createUser && createState.username && createState.password) {
        payload.user_profile = {
          username: createState.username.trim(),
          password: createState.password,
          role: createState.role,
        };
      }
      const created = await createEmployee(payload);
      toast("success", t("employees.createSuccess", { name: created.full_name }));
      closeCreate();
      fetchEmployees();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("employees.createError");
      setCreateErrors({ api: msg });
    } finally {
      setCreateSubmitting(false);
    }
  }

  function startEdit(emp: Employee) {
    setEditingEmployee(emp);
    setEditState({
      full_name: emp.full_name,
      position: emp.position,
      department: emp.department ?? "",
      phone_number: emp.phone_number ?? "",
      base_salary: emp.base_salary ?? "",
      employment_type: emp.employment_type,
      terminated_at: emp.terminated_at ?? "",
    });
    setEditErrors({});
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    const isSalary = editState.employment_type === "SALARY";
    const errs: Record<string, string> = {};
    if (!editState.full_name.trim()) errs.full_name = t("employees.validationRequired");
    if (!editState.position.trim()) errs.position = t("employees.validationRequired");
    if (isSalary && !editState.base_salary) errs.base_salary = t("employees.validationRequired");
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditErrors({});
    setEditSubmitting(true);
    try {
      const updated = await updateEmployee(editingEmployee.id, {
        full_name: editState.full_name.trim(),
        position: editState.position.trim(),
        department: editState.department.trim() || null,
        phone_number: editState.phone_number.trim() || null,
        base_salary: isSalary && editState.base_salary ? parseFloat(editState.base_salary) : undefined,
        employment_type: editState.employment_type,
        terminated_at: editState.terminated_at || null,
      });
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      toast("success", t("employees.updateSuccess", { name: updated.full_name }));
      setEditingEmployee(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("employees.updateError");
      setEditErrors({ api: msg });
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(emp: Employee) {
    const ok = await confirm({
      message: t("employees.deleteConfirm", { name: emp.full_name }),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(emp.id);
    try {
      await deleteEmployee(emp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      setTotal((n) => n - 1);
      toast("success", t("employees.deleteSuccess", { name: emp.full_name }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("employees.deleteError");
      toast("error", msg);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAttachUser(e: React.FormEvent) {
    e.preventDefault();
    if (!attachEmployee) return;
    setAttachSubmitting(true);
    setAttachError(null);
    try {
      const updated = await attachUserToEmployee(attachEmployee.id, {
        username: attachState.username.trim(),
        password: attachState.password,
        role: attachState.role,
      });
      setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
      toast("success", t("employees.attachUserSuccess", { name: attachEmployee.full_name }));
      setAttachEmployee(null);
      setAttachState({ username: "", password: "", role: "employee" });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const msg =
        status === 409
          ? t("employees.attachUserConflict")
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              t("employees.attachUserError"));
      setAttachError(msg);
    } finally {
      setAttachSubmitting(false);
    }
  }

  if (!canRead) {
    return (
      <div>
        <PageHead title={t("employees.title")} subtitle={t("employees.subtitle")} />
        <EmptyState title={t("common.noAccess")} />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title={t("employees.title")}
        subtitle={t("employees.subtitle")}
        actions={canWriteEmployees && <Button onClick={openCreate}>{t("employees.addNew")}</Button>}
      />

      <div className="mb-3">
        <Searchbar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("employees.searchPlaceholder")}
        />
      </div>

      {loading ? (
        <ListCard>
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        </ListCard>
      ) : employees.length === 0 ? (
        <EmptyState
          title={search ? t("employees.emptySearch") : t("employees.emptyList")}
        />
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden">
            <ListCard>
              {employees.map((emp) => (
                <ListRow
                  key={emp.id}
                  avatar={<span>{initials(emp.full_name)}</span>}
                  title={emp.full_name}
                  subtitle={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{emp.position}</span>
                      {emp.phone_number && <span>· {emp.phone_number}</span>}
                      <StatusPill variant={emp.is_active !== false ? "success" : "neutral"}>
                        {emp.is_active !== false ? t("employees.active") : t("employees.terminated")}
                      </StatusPill>
                    </span>
                  }
                  metric={
                    emp.employment_type === "COMMISSION"
                      ? { value: "—" }
                      : { value: salaryNum(emp.base_salary), unit: "so'm" }
                  }
                  onClick={canWriteEmployees ? () => startEdit(emp) : undefined}
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
                    <th>#</th>
                    <th>{t("employees.nameLabel")}</th>
                    <th>{t("employees.positionLabel")}</th>
                    <th>{t("employees.phoneLabel")}</th>
                    <th>{t("employees.salaryLabel")}</th>
                    <th>{t("employees.status")}</th>
                    {(canWriteEmployees || canDelete) && <th>{t("common.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr key={emp.id}>
                      <td>{(page - 1) * 10 + idx + 1}</td>
                      <td>{emp.full_name}</td>
                      <td>{emp.position}</td>
                      <td>{emp.phone_number ?? "—"}</td>
                      <td className="num">
                        {emp.employment_type === "COMMISSION" ? "—" : salaryNum(emp.base_salary)}
                      </td>
                      <td>
                        <StatusPill variant={emp.is_active !== false ? "success" : "neutral"}>
                          {emp.is_active !== false ? t("employees.active") : t("employees.terminated")}
                        </StatusPill>
                      </td>
                      {(canWriteEmployees || canDelete) && (
                        <td>
                          <div className="flex gap-1.5 items-center">
                            {canWriteEmployees && (
                              <>
                                <Button
                                  variant="warn"
                                  size="sm"
                                  onClick={() => startEdit(emp)}
                                  disabled={deletingId !== null}
                                >
                                  {t("common.edit")}
                                </Button>
                                {emp.user_id === null && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setAttachEmployee(emp);
                                      setAttachState({ username: "", password: "", role: "employee" });
                                      setAttachError(null);
                                    }}
                                    disabled={deletingId !== null}
                                  >
                                    {t("employees.attachUser")}
                                  </Button>
                                )}
                              </>
                            )}
                            {canDelete && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(emp)}
                                disabled={deletingId !== null}
                              >
                                {t("common.delete")}
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
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-3 text-sm text-bluegray-500">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                ← {t("common.previous")}
              </Button>
              <span className="text-xs">{t("employees.pageInfo", { page, totalPages, total })}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                {t("common.next")} →
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal
        open={canWriteEmployees && showCreateModal}
        onClose={closeCreate}
        title={t("employees.addNew")}
        size="lg"
      >
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">
                {t("employees.numberLabel")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder={t("employees.numberPlaceholder")}
                value={createState.employee_number}
                onChange={(e) => {
                  setCreateState((s) => ({ ...s, employee_number: e.target.value }));
                  setCreateErrors((prev) => { const n = { ...prev }; delete n.employee_number; return n; });
                }}
                disabled={createSubmitting}
                autoFocus
              />
              {createErrors.employee_number && <p className="field-error">{createErrors.employee_number}</p>}
            </div>
            <div className="field">
              <label className="field-label">
                {t("employees.hiredAtLabel")} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                className="input"
                value={createState.hired_at}
                onChange={(e) => {
                  setCreateState((s) => ({ ...s, hired_at: e.target.value }));
                  setCreateErrors((prev) => { const n = { ...prev }; delete n.hired_at; return n; });
                }}
                disabled={createSubmitting}
              />
              {createErrors.hired_at && <p className="field-error">{createErrors.hired_at}</p>}
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              {t("employees.nameLabel")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder={t("employees.namePlaceholder")}
              value={createState.full_name}
              onChange={(e) => {
                setCreateState((s) => ({ ...s, full_name: e.target.value }));
                setCreateErrors((prev) => { const n = { ...prev }; delete n.full_name; return n; });
              }}
              disabled={createSubmitting}
            />
            {createErrors.full_name && <p className="field-error">{createErrors.full_name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">
                {t("employees.positionLabel")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input"
                placeholder={t("employees.positionPlaceholder")}
                value={createState.position}
                onChange={(e) => {
                  setCreateState((s) => ({ ...s, position: e.target.value }));
                  setCreateErrors((prev) => { const n = { ...prev }; delete n.position; return n; });
                }}
                disabled={createSubmitting}
              />
              {createErrors.position && <p className="field-error">{createErrors.position}</p>}
            </div>
            <div className="field">
              <label className="field-label">{t("employees.departmentLabel")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("employees.departmentPlaceholder")}
                value={createState.department}
                onChange={(e) => setCreateState((s) => ({ ...s, department: e.target.value }))}
                disabled={createSubmitting}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">{t("employees.employmentType")}</label>
            <div className="flex gap-4">
              {(["SALARY", "COMMISSION"] as EmploymentType[]).map((et) => (
                <label key={et} className="flex items-center gap-2 cursor-pointer select-none text-sm text-bluegray-700">
                  <input
                    type="radio"
                    name="create_employment_type"
                    value={et}
                    checked={createState.employment_type === et}
                    onChange={() => setCreateState((s) => ({
                      ...s,
                      employment_type: et,
                      base_salary: et === "COMMISSION" ? "" : s.base_salary,
                    }))}
                    className="accent-cyan-500"
                    disabled={createSubmitting}
                  />
                  {et === "SALARY" ? t("employees.employmentTypeSalary") : t("employees.employmentTypeCommission")}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">{t("employees.phoneLabel")}</label>
              <input
                type="tel"
                className="input"
                value={createState.phone_number}
                onChange={(e) => setCreateState((s) => ({ ...s, phone_number: e.target.value }))}
                disabled={createSubmitting}
              />
            </div>
            {createState.employment_type === "SALARY" && (
              <div className="field">
                <label className="field-label">
                  {t("employees.salaryLabel")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={createState.base_salary}
                  onChange={(e) => {
                    setCreateState((s) => ({ ...s, base_salary: e.target.value }));
                    setCreateErrors((prev) => { const n = { ...prev }; delete n.base_salary; return n; });
                  }}
                  disabled={createSubmitting}
                />
                {createErrors.base_salary && <p className="field-error">{createErrors.base_salary}</p>}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createState.createUser}
              onChange={(e) => setCreateState((s) => ({ ...s, createUser: e.target.checked }))}
              className="w-4 h-4 rounded accent-cyan-500"
              disabled={createSubmitting}
            />
            <span className="text-sm font-medium text-bluegray-600">{t("employees.createUserToggle")}</span>
          </label>

          {createState.createUser && (
            <div className="bg-bluegray-50 rounded-xl p-4 flex flex-col gap-3">
              <div className="field">
                <label className="field-label">{t("employees.usernameLabel")}</label>
                <input
                  type="text"
                  className="input"
                  value={createState.username}
                  onChange={(e) => setCreateState((s) => ({ ...s, username: e.target.value }))}
                  disabled={createSubmitting}
                />
              </div>
              <div className="field">
                <label className="field-label">{t("employees.passwordLabel")}</label>
                <input
                  type="password"
                  className="input"
                  value={createState.password}
                  onChange={(e) => setCreateState((s) => ({ ...s, password: e.target.value }))}
                  disabled={createSubmitting}
                />
              </div>
              <div className="field">
                <label className="field-label">{t("employees.roleLabel")}</label>
                <select
                  className="input"
                  value={createState.role}
                  onChange={(e) => setCreateState((s) => ({ ...s, role: e.target.value }))}
                  disabled={createSubmitting}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabel(r, t)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {createErrors.api && (
            <p className="field-error bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeCreate}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createSubmitting}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={canWriteEmployees && editingEmployee !== null}
        onClose={() => { setEditingEmployee(null); setEditErrors({}); }}
        title={editingEmployee ? editingEmployee.full_name : t("common.edit")}
        size="lg"
      >
        <form onSubmit={handleUpdate} noValidate className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label">
              {t("employees.nameLabel")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="input"
              value={editState.full_name}
              onChange={(e) => {
                setEditState((s) => ({ ...s, full_name: e.target.value }));
                setEditErrors((prev) => { const n = { ...prev }; delete n.full_name; return n; });
              }}
              disabled={editSubmitting}
              autoFocus
            />
            {editErrors.full_name && <p className="field-error">{editErrors.full_name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">
                {t("employees.positionLabel")} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={editState.position}
                onChange={(e) => {
                  setEditState((s) => ({ ...s, position: e.target.value }));
                  setEditErrors((prev) => { const n = { ...prev }; delete n.position; return n; });
                }}
                disabled={editSubmitting}
              />
              {editErrors.position && <p className="field-error">{editErrors.position}</p>}
            </div>
            <div className="field">
              <label className="field-label">{t("employees.departmentLabel")}</label>
              <input
                type="text"
                className="input"
                value={editState.department}
                onChange={(e) => setEditState((s) => ({ ...s, department: e.target.value }))}
                disabled={editSubmitting}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">{t("employees.employmentType")}</label>
            <div className="flex gap-4">
              {(["SALARY", "COMMISSION"] as EmploymentType[]).map((et) => (
                <label key={et} className="flex items-center gap-2 cursor-pointer select-none text-sm text-bluegray-700">
                  <input
                    type="radio"
                    name="edit_employment_type"
                    value={et}
                    checked={editState.employment_type === et}
                    onChange={() => setEditState((s) => ({
                      ...s,
                      employment_type: et,
                      base_salary: et === "COMMISSION" ? "" : s.base_salary,
                    }))}
                    className="accent-cyan-500"
                    disabled={editSubmitting}
                  />
                  {et === "SALARY" ? t("employees.employmentTypeSalary") : t("employees.employmentTypeCommission")}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">{t("employees.phoneLabel")}</label>
              <input
                type="tel"
                className="input"
                value={editState.phone_number}
                onChange={(e) => setEditState((s) => ({ ...s, phone_number: e.target.value }))}
                disabled={editSubmitting}
              />
            </div>
            {editState.employment_type === "SALARY" && (
              <div className="field">
                <label className="field-label">
                  {t("employees.salaryLabel")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={editState.base_salary}
                  onChange={(e) => {
                    setEditState((s) => ({ ...s, base_salary: e.target.value }));
                    setEditErrors((prev) => { const n = { ...prev }; delete n.base_salary; return n; });
                  }}
                  disabled={editSubmitting}
                />
                {editErrors.base_salary && <p className="field-error">{editErrors.base_salary}</p>}
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">{t("employees.terminatedAtLabel")}</label>
            <input
              type="date"
              className="input"
              value={editState.terminated_at}
              onChange={(e) => setEditState((s) => ({ ...s, terminated_at: e.target.value }))}
              disabled={editSubmitting}
            />
          </div>

          {editErrors.api && (
            <p className="field-error bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErrors.api}</p>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <div className="flex gap-2 flex-wrap">
              {editingEmployee?.user_id === null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!editingEmployee) return;
                    setAttachEmployee(editingEmployee);
                    setAttachState({ username: "", password: "", role: "employee" });
                    setAttachError(null);
                    setEditingEmployee(null);
                  }}
                >
                  {t("employees.attachUser")}
                </Button>
              )}
              {canDelete && editingEmployee && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => editingEmployee && handleDelete(editingEmployee)}
                  disabled={deletingId !== null}
                >
                  {deletingId === editingEmployee.id ? t("employees.deleting") : t("common.delete")}
                </Button>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditingEmployee(null); setEditErrors({}); }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Attach user modal */}
      <Modal
        open={attachEmployee !== null}
        onClose={() => { setAttachEmployee(null); setAttachError(null); }}
        title={attachEmployee ? t("employees.attachUserTitle", { name: attachEmployee.full_name }) : ""}
      >
        <form onSubmit={handleAttachUser} noValidate className="flex flex-col gap-4">
          <div className="field">
            <label className="field-label">{t("employees.usernameLabel")}</label>
            <input
              type="text"
              className="input"
              value={attachState.username}
              onChange={(e) => setAttachState((s) => ({ ...s, username: e.target.value }))}
              disabled={attachSubmitting}
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label">{t("employees.passwordLabel")}</label>
            <input
              type="password"
              className="input"
              value={attachState.password}
              onChange={(e) => setAttachState((s) => ({ ...s, password: e.target.value }))}
              disabled={attachSubmitting}
            />
          </div>
          <div className="field">
            <label className="field-label">{t("employees.roleLabel")}</label>
            <select
              className="input"
              value={attachState.role}
              onChange={(e) => setAttachState((s) => ({ ...s, role: e.target.value }))}
              disabled={attachSubmitting}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          {attachError && <p className="field-error">{attachError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setAttachEmployee(null); setAttachError(null); }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={attachSubmitting}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
