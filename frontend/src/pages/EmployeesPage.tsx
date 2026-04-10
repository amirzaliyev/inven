import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
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

function formatSalary(salary: string | number | null): string {
  if (salary === null || salary === undefined) return "—";
  const n = typeof salary === "string" ? parseFloat(salary) : salary;
  if (isNaN(n)) return "—";
  return n.toLocaleString();
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

export default function EmployeesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();

  const canRead = hasPermission("employees:read");
  const canWrite = hasPermission("employees:write");
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
  const [createState, setCreateState] = useState<CreateState>({
    employee_number: "", full_name: "", position: "", department: "",
    phone_number: "", base_salary: "", employment_type: "SALARY", hired_at: "",
    createUser: false, username: "", password: "", role: "employee",
  });
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
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
      setShowCreateModal(false);
      setCreateErrors({});
      setCreateState({
        employee_number: "", full_name: "", position: "", department: "",
        phone_number: "", base_salary: "", employment_type: "SALARY", hired_at: "",
        createUser: false, username: "", password: "", role: "employee",
      });
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

  async function handleUpdate() {
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

  const inputCls =
    "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  if (!canRead) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("employees.title")}</h1>
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
    <div className="max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("employees.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-6">{t("employees.subtitle")}</p>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("employees.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{total}</span>
          </div>
          {canWrite && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              + {t("employees.addNew")}
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-3">
          <form onSubmit={handleSearch} className="flex gap-2 items-center">
            <input
              type="text"
              placeholder={t("employees.searchPlaceholder")}
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
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              >
                {t("common.clear")}
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : employees.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">
            {search ? t("employees.emptySearch") : t("employees.emptyList")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.numberLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.nameLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.positionLabel")}</th>
                    <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.departmentLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.employmentType")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.salaryLabel")}</th>
                    <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("employees.status")}</th>
                    {(canWrite || canDelete) && (
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.actions")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-bluegray-50">
                      <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        <span className="text-bluegray-400 text-xs">#{emp.id}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{emp.employee_number}</span>
                          {emp.user_id !== null && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-cyan-50 text-cyan-600 text-[10px] font-semibold rounded-full">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {t("employees.hasLogin")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        {emp.full_name}
                      </td>
                      <td className="px-5 py-3 text-sm text-bluegray-500 border-b border-bluegray-100">
                        {emp.position}
                      </td>
                      <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-400 border-b border-bluegray-100">
                        {emp.department ?? "—"}
                      </td>
                      <td className="px-5 py-3 border-b border-bluegray-100">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.employment_type === "SALARY"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {emp.employment_type === "SALARY" ? t("employees.employmentTypeSalary") : t("employees.employmentTypeCommission")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                        {emp.employment_type === "COMMISSION" ? "—" : formatSalary(emp.base_salary)}
                      </td>
                      <td className="px-5 py-3 border-b border-bluegray-100">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${emp.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {emp.is_active ? t("employees.active") : t("employees.terminated")}
                        </span>
                      </td>
                      {(canWrite || canDelete) && (
                        <td className="px-5 py-3 text-sm border-b border-bluegray-100">
                          <div className="flex gap-1.5 items-center">
                            {canWrite && (
                              <>
                                <button
                                  onClick={() => startEdit(emp)}
                                  disabled={deletingId !== null}
                                  title={t("common.edit")}
                                  className="p-1.5 text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50 cursor-pointer disabled:opacity-40"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                {emp.user_id === null && (
                                  <button
                                    onClick={() => { setAttachEmployee(emp); setAttachState({ username: "", password: "", role: "employee" }); setAttachError(null); }}
                                    disabled={deletingId !== null}
                                    title={t("employees.attachUser")}
                                    className="p-1.5 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 cursor-pointer disabled:opacity-40"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(emp)}
                                disabled={deletingId !== null}
                                title={t("common.delete")}
                                className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-40"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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
                <span className="text-xs">{t("employees.pageInfo", { page, totalPages, total })}</span>
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
        open={canWrite && showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateState({
            employee_number: "", full_name: "", position: "", department: "",
            phone_number: "", base_salary: "", employment_type: "SALARY", hired_at: "",
            createUser: false, username: "", password: "", role: "employee",
          });
        }}
        title={t("employees.addNew")}
        size="lg"
      >
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.numberLabel")} <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder={t("employees.numberPlaceholder")}
                value={createState.employee_number}
                onChange={(e) => { setCreateState((s) => ({ ...s, employee_number: e.target.value })); setCreateErrors((prev) => { const n = { ...prev }; delete n.employee_number; return n; }); }}
                className={`${inputCls} ${createErrors.employee_number ? "!border-red-400" : ""}`}
                disabled={createSubmitting}
                autoFocus
              />
              <p className="text-xs text-red-600 min-h-4">{createErrors.employee_number ?? "\u00A0"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.hiredAtLabel")} <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={createState.hired_at}
                onChange={(e) => { setCreateState((s) => ({ ...s, hired_at: e.target.value })); setCreateErrors((prev) => { const n = { ...prev }; delete n.hired_at; return n; }); }}
                className={`${inputCls} ${createErrors.hired_at ? "!border-red-400" : ""}`}
                disabled={createSubmitting}
              />
              <p className="text-xs text-red-600 min-h-4">{createErrors.hired_at ?? "\u00A0"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.nameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder={t("employees.namePlaceholder")}
              value={createState.full_name}
              onChange={(e) => { setCreateState((s) => ({ ...s, full_name: e.target.value })); setCreateErrors((prev) => { const n = { ...prev }; delete n.full_name; return n; }); }}
              className={`${inputCls} ${createErrors.full_name ? "!border-red-400" : ""}`}
              disabled={createSubmitting}
            />
            <p className="text-xs text-red-600 min-h-4">{createErrors.full_name ?? "\u00A0"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.positionLabel")} <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder={t("employees.positionPlaceholder")}
                value={createState.position}
                onChange={(e) => { setCreateState((s) => ({ ...s, position: e.target.value })); setCreateErrors((prev) => { const n = { ...prev }; delete n.position; return n; }); }}
                className={`${inputCls} ${createErrors.position ? "!border-red-400" : ""}`}
                disabled={createSubmitting}
              />
              <p className="text-xs text-red-600 min-h-4">{createErrors.position ?? "\u00A0"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.departmentLabel")}</label>
              <input
                type="text"
                placeholder={t("employees.departmentPlaceholder")}
                value={createState.department}
                onChange={(e) => setCreateState((s) => ({ ...s, department: e.target.value }))}
                className={inputCls}
                disabled={createSubmitting}
              />
            </div>
          </div>

          {/* Employment Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.employmentType")}</label>
            <div className="flex gap-4">
              {(["SALARY", "COMMISSION"] as EmploymentType[]).map((et) => (
                <label key={et} className="flex items-center gap-2 cursor-pointer select-none text-sm text-bluegray-700">
                  <input
                    type="radio"
                    name="create_employment_type"
                    value={et}
                    checked={createState.employment_type === et}
                    onChange={() => setCreateState((s) => ({ ...s, employment_type: et, base_salary: et === "COMMISSION" ? "" : s.base_salary }))}
                    className="accent-cyan-500"
                    disabled={createSubmitting}
                  />
                  {et === "SALARY" ? t("employees.employmentTypeSalary") : t("employees.employmentTypeCommission")}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.phoneLabel")}</label>
              <input
                type="tel"
                value={createState.phone_number}
                onChange={(e) => setCreateState((s) => ({ ...s, phone_number: e.target.value }))}
                className={inputCls}
                disabled={createSubmitting}
              />
            </div>
            {createState.employment_type === "SALARY" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-bluegray-600">{t("employees.salaryLabel")} <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createState.base_salary}
                  onChange={(e) => { setCreateState((s) => ({ ...s, base_salary: e.target.value })); setCreateErrors((prev) => { const n = { ...prev }; delete n.base_salary; return n; }); }}
                  className={`${inputCls} ${createErrors.base_salary ? "!border-red-400" : ""}`}
                  disabled={createSubmitting}
                />
                <p className="text-xs text-red-600 min-h-4">{createErrors.base_salary ?? "\u00A0"}</p>
              </div>
            )}
          </div>

          {/* Create user toggle */}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-bluegray-600">{t("employees.usernameLabel")}</label>
                <input
                  type="text"
                  value={createState.username}
                  onChange={(e) => setCreateState((s) => ({ ...s, username: e.target.value }))}
                  className={inputCls}
                  disabled={createSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-bluegray-600">{t("employees.passwordLabel")}</label>
                <input
                  type="password"
                  value={createState.password}
                  onChange={(e) => setCreateState((s) => ({ ...s, password: e.target.value }))}
                  className={inputCls}
                  disabled={createSubmitting}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-bluegray-600">{t("employees.roleLabel")}</label>
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
            </div>
          )}

          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setCreateErrors({});
                setCreateState({
                  employee_number: "", full_name: "", position: "", department: "",
                  phone_number: "", base_salary: "", employment_type: "SALARY", hired_at: "",
                  createUser: false, username: "", password: "", role: "employee",
                });
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
              {createSubmitting ? t("employees.creating") : t("employees.create")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={canWrite && editingEmployee !== null}
        onClose={() => { setEditingEmployee(null); setEditErrors({}); }}
        title={editingEmployee ? editingEmployee.full_name : t("common.edit")}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.nameLabel")} <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={editState.full_name}
              onChange={(e) => { setEditState((s) => ({ ...s, full_name: e.target.value })); setEditErrors((prev) => { const n = { ...prev }; delete n.full_name; return n; }); }}
              className={`${inputCls} ${editErrors.full_name ? "!border-red-400" : ""}`}
              disabled={editSubmitting}
              autoFocus
            />
            <p className="text-xs text-red-600 min-h-4">{editErrors.full_name ?? "\u00A0"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.positionLabel")} <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={editState.position}
                onChange={(e) => { setEditState((s) => ({ ...s, position: e.target.value })); setEditErrors((prev) => { const n = { ...prev }; delete n.position; return n; }); }}
                className={`${inputCls} ${editErrors.position ? "!border-red-400" : ""}`}
                disabled={editSubmitting}
              />
              <p className="text-xs text-red-600 min-h-4">{editErrors.position ?? "\u00A0"}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.departmentLabel")}</label>
              <input
                type="text"
                value={editState.department}
                onChange={(e) => setEditState((s) => ({ ...s, department: e.target.value }))}
                className={inputCls}
                disabled={editSubmitting}
              />
            </div>
          </div>

          {/* Employment Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.employmentType")}</label>
            <div className="flex gap-4">
              {(["SALARY", "COMMISSION"] as EmploymentType[]).map((et) => (
                <label key={et} className="flex items-center gap-2 cursor-pointer select-none text-sm text-bluegray-700">
                  <input
                    type="radio"
                    name="edit_employment_type"
                    value={et}
                    checked={editState.employment_type === et}
                    onChange={() => setEditState((s) => ({ ...s, employment_type: et, base_salary: et === "COMMISSION" ? "" : s.base_salary }))}
                    className="accent-cyan-500"
                    disabled={editSubmitting}
                  />
                  {et === "SALARY" ? t("employees.employmentTypeSalary") : t("employees.employmentTypeCommission")}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-600">{t("employees.phoneLabel")}</label>
              <input
                type="tel"
                value={editState.phone_number}
                onChange={(e) => setEditState((s) => ({ ...s, phone_number: e.target.value }))}
                className={inputCls}
                disabled={editSubmitting}
              />
            </div>
            {editState.employment_type === "SALARY" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-bluegray-600">{t("employees.salaryLabel")} <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editState.base_salary}
                  onChange={(e) => { setEditState((s) => ({ ...s, base_salary: e.target.value })); setEditErrors((prev) => { const n = { ...prev }; delete n.base_salary; return n; }); }}
                  className={`${inputCls} ${editErrors.base_salary ? "!border-red-400" : ""}`}
                  disabled={editSubmitting}
                />
                <p className="text-xs text-red-600 min-h-4">{editErrors.base_salary ?? "\u00A0"}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.terminatedAtLabel")}</label>
            <input
              type="date"
              value={editState.terminated_at}
              onChange={(e) => setEditState((s) => ({ ...s, terminated_at: e.target.value }))}
              className={inputCls}
              disabled={editSubmitting}
            />
          </div>
          {editErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setEditingEmployee(null); setEditErrors({}); }}
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

      {/* Attach user modal */}
      <Modal
        open={attachEmployee !== null}
        onClose={() => { setAttachEmployee(null); setAttachError(null); }}
        title={attachEmployee ? t("employees.attachUserTitle", { name: attachEmployee.full_name }) : ""}
      >
        <form onSubmit={handleAttachUser} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.usernameLabel")}</label>
            <input
              type="text"
              value={attachState.username}
              onChange={(e) => setAttachState((s) => ({ ...s, username: e.target.value }))}
              className={inputCls}
              disabled={attachSubmitting}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.passwordLabel")}</label>
            <input
              type="password"
              value={attachState.password}
              onChange={(e) => setAttachState((s) => ({ ...s, password: e.target.value }))}
              className={inputCls}
              disabled={attachSubmitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("employees.roleLabel")}</label>
            <select
              value={attachState.role}
              onChange={(e) => setAttachState((s) => ({ ...s, role: e.target.value }))}
              className={inputCls}
              disabled={attachSubmitting}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          {attachError && <p className="text-xs text-red-600">{attachError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setAttachEmployee(null); setAttachError(null); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={attachSubmitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${attachSubmitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}
            >
              {attachSubmitting ? t("employees.attaching") : t("employees.attachUser")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
