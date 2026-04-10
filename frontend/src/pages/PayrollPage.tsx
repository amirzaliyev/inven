import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import {
  generatePayroll,
  listPayroll,
  getPayroll,
  approvePayroll,
  markPayrollPaid,
  getPayslip,
} from "../api/payroll";
import type { PayrollResponse, PayrollStatus, Payslip, CommissionLine } from "../types";

function statusBadge(status: string) {
  if (status === "APPROVED") return "bg-cyan-100 text-cyan-700";
  if (status === "PAID") return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-700";
}

function statusLabel(status: string, t: (k: string) => string) {
  if (status === "APPROVED") return t("payroll.statusApproved");
  if (status === "PAID") return t("payroll.statusPaid");
  return t("payroll.statusDraft");
}

const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

function formatPeriod(periodStart: string, lang: string): string {
  const date = new Date(periodStart + "T00:00:00");
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  if (lang === "uz") {
    return `${UZ_MONTHS[monthIndex]} ${year}`;
  }
  return date.toLocaleDateString("en", { year: "numeric", month: "short" });
}

export default function PayrollPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();

  const canRead = hasPermission("payroll:read");
  const canGenerate = hasPermission("payroll:generate");
  const canApprove = hasPermission("payroll:approve");

  const [payrolls, setPayrolls] = useState<PayrollResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | "">("");

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [periodMonth, setPeriodMonth] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});

  // View modal
  const [viewPayroll, setViewPayroll] = useState<PayrollResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Payslip detail
  const [detailPayslip, setDetailPayslip] = useState<Payslip | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Actions
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPayroll(page, 10, statusFilter || undefined);
      setPayrolls(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch {
      toast("error", t("payroll.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => { fetchPayrolls(); }, [fetchPayrolls]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!periodMonth) errs.month = t("payroll.validationRequired");
    if (Object.keys(errs).length) { setGenerateErrors(errs); return; }
    setGenerating(true);
    setGenerateErrors({});
    try {
      // Derive period_start (first day) and period_end (last day) from yyyy-MM
      const [year, month] = periodMonth.split("-").map(Number);
      const periodStart = `${periodMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const periodEnd = `${periodMonth}-${String(lastDay).padStart(2, "0")}`;
      await generatePayroll({ period_start: periodStart, period_end: periodEnd });
      toast("success", t("payroll.generateSuccess"));
      setPeriodMonth("");
      setShowGenerateModal(false);
      fetchPayrolls();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("payroll.createError");
      setGenerateErrors({ api: msg });
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(p: PayrollResponse) {
    const ok = await confirm({ message: t("payroll.approveConfirm"), danger: false });
    if (!ok) return;
    setActionId(p.id);
    try {
      const updated = await approvePayroll(p.id);
      setPayrolls(prev => prev.map(x => x.id === updated.id ? updated : x));
      toast("success", t("payroll.approveSuccess"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("payroll.approveError");
      toast("error", msg);
    } finally {
      setActionId(null);
    }
  }

  async function handleMarkPaid(p: PayrollResponse) {
    const ok = await confirm({ message: t("payroll.markPaidConfirm"), danger: false });
    if (!ok) return;
    setActionId(p.id);
    try {
      const updated = await markPayrollPaid(p.id);
      setPayrolls(prev => prev.map(x => x.id === updated.id ? updated : x));
      toast("success", t("payroll.markPaidSuccess"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("payroll.markPaidError");
      toast("error", msg);
    } finally {
      setActionId(null);
    }
  }

  async function handleView(p: PayrollResponse) {
    setViewLoading(true);
    setViewPayroll(p);
    setDetailPayslip(null);
    try {
      const full = await getPayroll(p.id);
      setViewPayroll(full);
    } catch {
      toast("error", t("payroll.loadError"));
    } finally {
      setViewLoading(false);
    }
  }

  async function handlePayslipDetail(ps: Payslip) {
    setDetailLoading(true);
    try {
      const full = await getPayslip(ps.id);
      setDetailPayslip(full);
    } catch {
      toast("error", t("payroll.loadError"));
    } finally {
      setDetailLoading(false);
    }
  }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  if (!canRead) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("payroll.title")}</h1>
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
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("payroll.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-6">{t("payroll.subtitle")}</p>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("payroll.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{total}</span>
          </div>
          {canGenerate && (
            <button onClick={() => setShowGenerateModal(true)} className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors">
              + {t("payroll.generate")}
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-3">
          <div className="flex gap-2 items-center">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as PayrollStatus | ""); setPage(1); }} className={inputCls}>
              <option value="">{t("payroll.allStatuses")}</option>
              <option value="DRAFT">{t("payroll.statusDraft")}</option>
              <option value="APPROVED">{t("payroll.statusApproved")}</option>
              <option value="PAID">{t("payroll.statusPaid")}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : payrolls.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("payroll.emptyList")}</div>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("payroll.period")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.status")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-right">{t("payroll.totalAmount")}</th>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-right">{t("payroll.payslipCount")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-3 text-left w-32">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map(p => (
                  <tr key={p.id} className="hover:bg-bluegray-50">
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-400 border-b border-bluegray-100">#{p.id}</td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{formatPeriod(p.period_start, i18n.language)}</td>
                    <td className="px-5 py-3 border-b border-bluegray-100">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(p.status)}`}>
                        {statusLabel(p.status, t)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{p.total_amount.toLocaleString()}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-500 border-b border-bluegray-100 text-right">{p.payslip_count}</td>
                    <td className="px-4 py-3 border-b border-bluegray-100">
                      <div className="flex gap-1.5 items-center">
                        <button onClick={() => handleView(p)}
                          className="px-2.5 py-1 text-xs font-medium text-bluegray-600 border border-bluegray-200 rounded-lg hover:bg-bluegray-50 cursor-pointer">
                          {t("payroll.view")}
                        </button>
                        {p.status === "DRAFT" && canApprove && (
                          <button onClick={() => handleApprove(p)} disabled={actionId === p.id}
                            className="px-2.5 py-1 text-xs font-medium text-cyan-600 border border-cyan-200 rounded-lg hover:bg-cyan-50 cursor-pointer disabled:opacity-40">
                            {t("payroll.approveAction")}
                          </button>
                        )}
                        {p.status === "APPROVED" && canApprove && (
                          <button onClick={() => handleMarkPaid(p)} disabled={actionId === p.id}
                            className="px-2.5 py-1 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 cursor-pointer disabled:opacity-40 whitespace-nowrap">
                            {t("payroll.markPaidAction")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
                <button className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`} onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <span className="sm:hidden">&larr;</span><span className="hidden sm:inline">&larr; {t("common.previous")}</span>
                </button>
                <span className="text-xs">{t("common.pageOf", { page, total: totalPages })}</span>
                <button className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page >= totalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  <span className="sm:hidden">&rarr;</span><span className="hidden sm:inline">{t("common.next")} &rarr;</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generate modal */}
      <Modal open={canGenerate && showGenerateModal} onClose={() => { setShowGenerateModal(false); setPeriodMonth(""); setGenerateErrors({}); }} title={t("payroll.generateTitle")}>
        <form onSubmit={handleGenerate} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("payroll.month")} <span className="text-red-400">*</span></label>
            <input type="month" value={periodMonth} onChange={(e) => { setPeriodMonth(e.target.value); setGenerateErrors(prev => { const { month: _, ...rest } = prev; return rest; }); }} className={`${inputCls} ${generateErrors.month ? "!border-red-400" : ""}`} />
            <p className="text-xs text-red-600 min-h-4">{generateErrors.month ?? "\u00A0"}</p>
          </div>
          {generateErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{generateErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowGenerateModal(false); setPeriodMonth(""); setGenerateErrors({}); }} className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer">{t("common.cancel")}</button>
            <button type="submit" disabled={generating} className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${generating ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}>
              {generating ? t("payroll.generating") : t("payroll.generate")}
            </button>
          </div>
        </form>
      </Modal>

      {/* View payroll modal */}
      <Modal open={viewPayroll !== null} onClose={() => { setViewPayroll(null); setDetailPayslip(null); }} title={viewPayroll ? t("payroll.viewTitle", { id: viewPayroll.id, period: formatPeriod(viewPayroll.period_start, i18n.language) }) : ""}>
        {viewLoading ? (
          <div className="py-8 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        ) : viewPayroll && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 text-sm">
              <div><span className="text-bluegray-400">{t("common.status")}:</span> <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(viewPayroll.status)}`}>{statusLabel(viewPayroll.status, t)}</span></div>
              <div><span className="text-bluegray-400">{t("payroll.totalAmount")}:</span> <span className="font-semibold tabular-nums">{viewPayroll.total_amount.toLocaleString()}</span></div>
            </div>

            {!viewPayroll.payslips || viewPayroll.payslips.length === 0 ? (
              <div className="py-6 text-center text-sm text-bluegray-400">{t("payroll.noPayslips")}</div>
            ) : (
              <div className="border border-bluegray-200 rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-left">{t("payroll.employeeId")}</th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-right">{t("payroll.baseSalary")}</th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-right">{t("payroll.commissionAmount")}</th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 text-right">{t("payroll.totalPayslip")}</th>
                      <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase px-4 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewPayroll.payslips.map(ps => (
                      <tr key={ps.id} className="hover:bg-bluegray-50">
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100">{ps.employee_name ?? `#${ps.employee_id}`}</td>
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{ps.base_salary.toLocaleString()}</td>
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{ps.commission_amount.toLocaleString()}</td>
                        <td className="px-4 py-2 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums font-semibold">{ps.total_amount.toLocaleString()}</td>
                        <td className="px-4 py-2 border-b border-bluegray-100">
                          {ps.commission_amount > 0 && (
                            <button onClick={() => handlePayslipDetail(ps)} className="text-xs text-cyan-600 hover:underline cursor-pointer">
                              {t("payroll.details")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Commission detail inline */}
            {detailLoading && <div className="text-center text-sm text-bluegray-400">{t("common.loading")}</div>}
            {detailPayslip && detailPayslip.commission_lines && detailPayslip.commission_lines.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">{t("payroll.commissionLines")} — {detailPayslip.employee_name ?? `#${detailPayslip.employee_id}`}</h4>
                <div className="border border-bluegray-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-left">{t("payroll.batchId")}</th>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-left">{t("payroll.productId")}</th>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-right">{t("payroll.qty")}</th>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-right">{t("payroll.present")}</th>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-right">{t("payroll.share")}</th>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-right">{t("payroll.rate")}</th>
                        <th className="bg-bluegray-50 font-semibold text-bluegray-500 uppercase px-3 py-2 text-right">{t("payroll.amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailPayslip.commission_lines.map((cl: CommissionLine, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100">#{cl.batch_id}</td>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100">#{cl.product_id}</td>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{cl.batch_quantity.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100 text-right">{cl.present_count}</td>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{cl.quantity_share}</td>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums">{cl.rate_per_unit}</td>
                          <td className="px-3 py-1.5 text-bluegray-700 border-b border-bluegray-100 text-right tabular-nums font-semibold">{cl.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
