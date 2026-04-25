import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAuth } from "../contexts/AuthContext";
import { Modal } from "../components/Modal";
import {
  PageHead,
  Button,
  FilterChip,
  ListCard,
  ListRow,
  EmptyState,
  StatusPill,
  initials,
  fmtMoney,
  type StatusVariant,
} from "../components/ui";
import {
  generatePayroll,
  listPayroll,
  getPayroll,
  approvePayroll,
  markPayrollPaid,
  getPayslip,
} from "../api/payroll";
import type { PayrollResponse, PayrollStatus, Payslip, CommissionLine } from "../types";

function statusVariant(status: string): StatusVariant {
  if (status === "PAID") return "success";
  if (status === "APPROVED") return "info";
  return "warn";
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
  const [, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | "">("");
  const [monthFilter, setMonthFilter] = useState("");

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

  const filteredPayrolls = monthFilter
    ? payrolls.filter(p => p.period_start.startsWith(monthFilter))
    : payrolls;

  function openCreate() {
    setShowGenerateModal(true);
  }

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

  if (!canRead) {
    return (
      <div className="page">
        <PageHead title={t("payroll.title", "Maosh")} subtitle={t("payroll.subtitle")} />
        <ListCard>
          <EmptyState title={t("common.noAccess")} />
        </ListCard>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHead
        title={t("payroll.title", "Maosh")}
        subtitle={t("payroll.subtitle")}
        actions={canGenerate && <Button onClick={openCreate}>{t("payroll.addNew", t("payroll.generate"))}</Button>}
      />

      {/* Month picker row */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-label">{t("payroll.month")}</label>
        <input
          type="month"
          className="input"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
      </div>

      {/* Status filter chip row */}
      <div className="chip-row">
        <FilterChip active={statusFilter === ""} onClick={() => { setStatusFilter(""); setPage(1); }}>
          {t("payroll.allStatuses")}
        </FilterChip>
        <FilterChip active={statusFilter === "DRAFT"} onClick={() => { setStatusFilter("DRAFT"); setPage(1); }}>
          {t("payroll.statusDraft")}
        </FilterChip>
        <FilterChip active={statusFilter === "APPROVED"} onClick={() => { setStatusFilter("APPROVED"); setPage(1); }}>
          {t("payroll.statusApproved")}
        </FilterChip>
        <FilterChip active={statusFilter === "PAID"} onClick={() => { setStatusFilter("PAID"); setPage(1); }}>
          {t("payroll.statusPaid")}
        </FilterChip>
      </div>

      {loading ? (
        <ListCard><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>{t("common.loading")}</div></ListCard>
      ) : filteredPayrolls.length === 0 ? (
        <ListCard>
          <EmptyState title={t("payroll.emptyList")} />
        </ListCard>
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden">
            <ListCard>
              {filteredPayrolls.map(p => {
                const name = `#${p.id}`;
                return (
                  <ListRow
                    key={p.id}
                    avatar={initials(name)}
                    title={name}
                    subtitle={
                      <>
                        {formatPeriod(p.period_start, i18n.language)} ·{" "}
                        <StatusPill variant={statusVariant(p.status)}>{statusLabel(p.status, t)}</StatusPill>
                      </>
                    }
                    metric={{ value: fmtMoney(p.total_amount), unit: "so'm" }}
                    onClick={() => handleView(p)}
                  />
                );
              })}
            </ListCard>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <ListCard>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("payroll.employeeId")}</th>
                    <th>{t("payroll.period")}</th>
                    <th style={{ textAlign: "right" }}>{t("payroll.baseSalary")}</th>
                    <th style={{ textAlign: "right" }}>{t("payroll.commissionAmount")}</th>
                    <th style={{ textAlign: "right" }}>{t("payroll.payslipCount")}</th>
                    <th style={{ textAlign: "right" }}>{t("payroll.totalAmount")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayrolls.map(p => (
                    <tr key={p.id} onClick={() => handleView(p)} style={{ cursor: "pointer" }}>
                      <td>#{p.id}</td>
                      <td>{formatPeriod(p.period_start, i18n.language)}</td>
                      <td style={{ textAlign: "right" }} className="num">—</td>
                      <td style={{ textAlign: "right" }} className="num">—</td>
                      <td style={{ textAlign: "right" }} className="num">{p.payslip_count}</td>
                      <td style={{ textAlign: "right" }} className="num">{fmtMoney(p.total_amount)}</td>
                      <td><StatusPill variant={statusVariant(p.status)}>{statusLabel(p.status, t)}</StatusPill></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {p.status === "DRAFT" && canApprove && (
                            <Button size="sm" variant="outline" onClick={() => handleApprove(p)} disabled={actionId === p.id}>
                              {t("payroll.approveAction")}
                            </Button>
                          )}
                          {p.status === "APPROVED" && canApprove && (
                            <Button size="sm" onClick={() => handleMarkPaid(p)} disabled={actionId === p.id}>
                              {t("payroll.markPaidAction", "To'lash")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ListCard>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", fontSize: 13, color: "#64748b" }}>
              <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                &larr; {t("common.previous")}
              </Button>
              <span style={{ fontSize: 12 }}>{t("common.pageOf", { page, total: totalPages })}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                {t("common.next")} &rarr;
              </Button>
            </div>
          )}
        </>
      )}

      {/* Generate modal */}
      <Modal open={canGenerate && showGenerateModal} onClose={() => { setShowGenerateModal(false); setPeriodMonth(""); setGenerateErrors({}); }} title={t("payroll.generateTitle")}>
        <form onSubmit={handleGenerate} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="field-label">{t("payroll.month")} <span style={{ color: "#f87171" }}>*</span></label>
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => { setPeriodMonth(e.target.value); setGenerateErrors(prev => { const { month: _, ...rest } = prev; return rest; }); }}
              className="input"
              style={generateErrors.month ? { borderColor: "#f87171" } : undefined}
            />
            <p style={{ fontSize: 12, color: "#dc2626", minHeight: 16, margin: 0 }}>{generateErrors.month ?? " "}</p>
          </div>
          {generateErrors.api && (
            <p style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "8px 12px", margin: 0 }}>
              {generateErrors.api}
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
            <Button type="button" variant="outline" onClick={() => { setShowGenerateModal(false); setPeriodMonth(""); setGenerateErrors({}); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={generating}>
              {generating ? t("payroll.generating") : t("payroll.generate")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View payroll / payslip detail modal */}
      <Modal
        open={viewPayroll !== null}
        onClose={() => { setViewPayroll(null); setDetailPayslip(null); }}
        title={viewPayroll ? t("payroll.viewTitle", { id: viewPayroll.id, period: formatPeriod(viewPayroll.period_start, i18n.language) }) : ""}
        size="lg"
      >
        {viewLoading ? (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>{t("common.loading")}</div>
        ) : viewPayroll && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("common.status")}: </span>
                <StatusPill variant={statusVariant(viewPayroll.status)}>{statusLabel(viewPayroll.status, t)}</StatusPill>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>{t("payroll.totalAmount")}: </span>
                <span style={{ fontWeight: 600 }}>{fmtMoney(viewPayroll.total_amount)} so'm</span>
              </div>
            </div>

            {!viewPayroll.payslips || viewPayroll.payslips.length === 0 ? (
              <EmptyState title={t("payroll.noPayslips")} />
            ) : (
              <ListCard>
                {viewPayroll.payslips.map(ps => (
                  <ListRow
                    key={ps.id}
                    avatar={initials(ps.employee_name ?? `#${ps.employee_id}`)}
                    title={ps.employee_name ?? `#${ps.employee_id}`}
                    subtitle={
                      <>
                        {t("payroll.baseSalary")}: {fmtMoney(ps.base_salary)} · {t("payroll.commissionAmount")}: {fmtMoney(ps.commission_amount)}
                      </>
                    }
                    metric={{ value: fmtMoney(ps.total_amount), unit: "so'm" }}
                    onClick={ps.commission_amount > 0 ? () => handlePayslipDetail(ps) : undefined}
                  />
                ))}
              </ListCard>
            )}

            {detailLoading && (
              <div style={{ textAlign: "center", fontSize: 13, color: "#94a3b8" }}>{t("common.loading")}</div>
            )}
            {detailPayslip && detailPayslip.commission_lines && detailPayslip.commission_lines.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {t("payroll.commissionLines")} — {detailPayslip.employee_name ?? `#${detailPayslip.employee_id}`}
                </h4>
                <ListCard>
                  {detailPayslip.commission_lines.map((cl: CommissionLine, i: number) => (
                    <ListRow
                      key={i}
                      title={`${t("payroll.batchId")} #${cl.batch_id} · ${t("payroll.productId")} #${cl.product_id}`}
                      subtitle={
                        <>
                          {t("payroll.qty")}: {cl.batch_quantity.toLocaleString()} · {t("payroll.present")}: {cl.present_count} · {t("payroll.share")}: {cl.quantity_share} · {t("payroll.rate")}: {cl.rate_per_unit}
                        </>
                      }
                      metric={{ value: fmtMoney(cl.amount), unit: "so'm" }}
                    />
                  ))}
                </ListCard>
              </div>
            )}

            {viewPayroll.status === "APPROVED" && canApprove && (
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                <Button onClick={() => handleMarkPaid(viewPayroll)} disabled={actionId === viewPayroll.id}>
                  {t("payroll.markPaidAction", "To'lash")}
                </Button>
              </div>
            )}
            {viewPayroll.status === "DRAFT" && canApprove && (
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                <Button onClick={() => handleApprove(viewPayroll)} disabled={actionId === viewPayroll.id}>
                  {t("payroll.approveAction")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
