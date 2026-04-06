import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createInventoryTransaction, listInventoryTransactions } from "../api/inventory-transactions";
import { TransactionType, SourceType } from "../types";
import type { InventoryTransaction, ITransactionLineCreate } from "../types";

interface LineItem {
  product_id: string;
  quantity: string;
}

const emptyLine = (): LineItem => ({ product_id: "", quantity: "" });

const initialForm = {
  transaction_date: "",
  transaction_type: TransactionType.DEBIT,
  source_type: SourceType.BATCH,
  source_id: "",
};

export default function InventoryTransactionsPage() {
  const { t } = useTranslation();

  const [form, setForm] = useState(initialForm);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // List state
  const [txns, setTxns] = useState<InventoryTransaction[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [filterType, setFilterType] = useState<TransactionType | "">("");
  const [filterSource, setFilterSource] = useState<SourceType | "">("");

  const fetchTransactions = useCallback(async () => {
    setListLoading(true);
    try {
      const result = await listInventoryTransactions(
        listPage,
        10,
        filterType || undefined,
        filterSource || undefined
      );
      setTxns(result.items);
      setListTotalPages(result.pages);
      setListTotal(result.total);
    } catch {
      // silently fail — list is non-critical
    } finally {
      setListLoading(false);
    }
  }, [listPage, filterType, filterSource]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // --- form field handlers ---

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleLineChange(index: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // --- submit ---

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!form.transaction_date) {
      setFeedback({ type: "error", message: t("transactions.validationDate") });
      return;
    }
    if (!form.source_id || isNaN(Number(form.source_id))) {
      setFeedback({ type: "error", message: t("transactions.validationSourceId") });
      return;
    }
    if (lines.length === 0) {
      setFeedback({ type: "error", message: t("transactions.validationLines") });
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.product_id || isNaN(Number(l.product_id))) {
        setFeedback({ type: "error", message: t("transactions.validationLineProductId", { n: i + 1 }) });
        return;
      }
      if (!l.quantity || isNaN(Number(l.quantity)) || Number(l.quantity) <= 0) {
        setFeedback({ type: "error", message: t("transactions.validationLineQuantity", { n: i + 1 }) });
        return;
      }
    }

    const parsedLines: ITransactionLineCreate[] = lines.map((l) => ({
      product_id: Number(l.product_id),
      quantity: Number(l.quantity),
    }));

    setSubmitting(true);
    try {
      const result = await createInventoryTransaction({
        transaction_date: form.transaction_date,
        transaction_type: form.transaction_type,
        source_type: form.source_type,
        source_id: Number(form.source_id),
        lines: parsedLines,
      });
      setForm(initialForm);
      setLines([emptyLine()]);
      setFeedback({ type: "success", message: t("transactions.createSuccess", { id: result.id }) });
      setListPage(1);
      fetchTransactions();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("transactions.unexpectedError");
      setFeedback({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  // --- styles ---

  const s = {
    page: {
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      maxWidth: 780,
      margin: "0 auto",
      padding: "32px 24px",
      color: "#1a1a2e",
    } as React.CSSProperties,

    heading: {
      fontSize: 24,
      fontWeight: 700,
      marginBottom: 28,
      color: "#1a1a2e",
    } as React.CSSProperties,

    card: {
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      padding: 28,
      marginBottom: 32,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: 13,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      color: "#64748b",
      marginBottom: 16,
    } as React.CSSProperties,

    row: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginBottom: 16,
    } as React.CSSProperties,

    field: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 6,
    } as React.CSSProperties,

    label: {
      fontSize: 13,
      fontWeight: 500,
      color: "#374151",
    } as React.CSSProperties,

    input: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      fontSize: 14,
      color: "#1a1a2e",
      background: "#fff",
      outline: "none",
      transition: "border-color 0.15s",
    } as React.CSSProperties,

    select: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      fontSize: 14,
      color: "#1a1a2e",
      background: "#fff",
      outline: "none",
    } as React.CSSProperties,

    lineRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr auto",
      gap: 12,
      alignItems: "end",
      marginBottom: 10,
    } as React.CSSProperties,

    btnPrimary: {
      padding: "9px 20px",
      background: "#3b5bdb",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    } as React.CSSProperties,

    btnSecondary: {
      padding: "8px 16px",
      background: "transparent",
      color: "#3b5bdb",
      border: "1px solid #3b5bdb",
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
    } as React.CSSProperties,

    btnRemove: {
      padding: "8px 12px",
      background: "transparent",
      color: "#ef4444",
      border: "1px solid #fca5a5",
      borderRadius: 6,
      fontSize: 13,
      cursor: "pointer",
    } as React.CSSProperties,

    btnAddLine: {
      padding: "7px 14px",
      background: "transparent",
      color: "#3b5bdb",
      border: "1px dashed #93c5fd",
      borderRadius: 6,
      fontSize: 13,
      cursor: "pointer",
      marginTop: 4,
    } as React.CSSProperties,

    formFooter: {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: 24,
      paddingTop: 20,
      borderTop: "1px solid #e2e8f0",
    } as React.CSSProperties,

    feedback: (type: "success" | "error"): React.CSSProperties => ({
      padding: "10px 16px",
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      marginBottom: 20,
      background: type === "success" ? "#f0fdf4" : "#fef2f2",
      color: type === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${type === "success" ? "#bbf7d0" : "#fecaca"}`,
    }),

    divider: {
      borderTop: "1px solid #e2e8f0",
      margin: "24px 0 20px",
    } as React.CSSProperties,

    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: 13,
    } as React.CSSProperties,

    th: {
      textAlign: "left" as const,
      padding: "8px 12px",
      background: "#f8fafc",
      color: "#64748b",
      fontWeight: 600,
      fontSize: 12,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      borderBottom: "1px solid #e2e8f0",
    } as React.CSSProperties,

    td: {
      padding: "10px 12px",
      borderBottom: "1px solid #f1f5f9",
      color: "#374151",
      verticalAlign: "top" as const,
    } as React.CSSProperties,

    badge: (type: TransactionType): React.CSSProperties => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      background: type === TransactionType.DEBIT ? "#fef3c7" : "#dbeafe",
      color: type === TransactionType.DEBIT ? "#92400e" : "#1e40af",
    }),

    emptyText: {
      color: "#94a3b8",
      fontSize: 13,
      textAlign: "center" as const,
      padding: "16px 0",
    } as React.CSSProperties,

    filterRow: {
      display: "flex",
      gap: 10,
      marginBottom: 16,
      alignItems: "center",
    } as React.CSSProperties,

    pagination: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 16,
      fontSize: 13,
      color: "#64748b",
    } as React.CSSProperties,

    pageBtn: {
      padding: "5px 14px",
      background: "#fff",
      color: "#374151",
      border: "1px solid #d1d5db",
      borderRadius: 5,
      fontSize: 13,
      cursor: "pointer",
    } as React.CSSProperties,

    pageBtnDisabled: {
      padding: "5px 14px",
      background: "#f9fafb",
      color: "#d1d5db",
      border: "1px solid #e5e7eb",
      borderRadius: 5,
      fontSize: 13,
      cursor: "not-allowed",
    } as React.CSSProperties,

    tableHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    } as React.CSSProperties,

    badge2: {
      background: "#eff6ff",
      color: "#2563eb",
      fontSize: 12,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 12,
    } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      <h1 style={s.heading}>{t("transactions.title")}</h1>

      {/* Form card */}
      <div style={s.card}>
        <p style={s.sectionTitle}>{t("transactions.newTransaction")}</p>

        {feedback && <div style={s.feedback(feedback.type)}>{feedback.message}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label} htmlFor="transaction_date">{t("transactions.transactionDate")}</label>
              <input
                id="transaction_date"
                name="transaction_date"
                type="date"
                value={form.transaction_date}
                onChange={handleFieldChange}
                style={s.input}
                required
              />
            </div>
            <div style={s.field}>
              <label style={s.label} htmlFor="transaction_type">{t("transactions.transactionType")}</label>
              <select
                id="transaction_type"
                name="transaction_type"
                value={form.transaction_type}
                onChange={handleFieldChange}
                style={s.select}
              >
                <option value={TransactionType.DEBIT}>{TransactionType.DEBIT}</option>
                <option value={TransactionType.CREDIT}>{TransactionType.CREDIT}</option>
              </select>
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label} htmlFor="source_type">{t("transactions.sourceType")}</label>
              <select
                id="source_type"
                name="source_type"
                value={form.source_type}
                onChange={handleFieldChange}
                style={s.select}
              >
                <option value={SourceType.SALES}>{SourceType.SALES}</option>
                <option value={SourceType.DEFECT}>{SourceType.DEFECT}</option>
                <option value={SourceType.BATCH}>{SourceType.BATCH}</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label} htmlFor="source_id">{t("transactions.sourceId")}</label>
              <input
                id="source_id"
                name="source_id"
                type="number"
                min={1}
                value={form.source_id}
                onChange={handleFieldChange}
                placeholder={t("transactions.sourceIdPlaceholder")}
                style={s.input}
                required
              />
            </div>
          </div>

          <div style={s.divider} />
          <p style={s.sectionTitle}>{t("transactions.lineItems")}</p>

          {lines.map((line, index) => (
            <div key={index} style={s.lineRow}>
              <div style={s.field}>
                {index === 0 && <label style={s.label}>{t("transactions.productId")}</label>}
                <input
                  type="number"
                  min={1}
                  value={line.product_id}
                  onChange={(e) => handleLineChange(index, "product_id", e.target.value)}
                  placeholder={t("transactions.productId")}
                  style={s.input}
                />
              </div>
              <div style={s.field}>
                {index === 0 && <label style={s.label}>{t("common.quantity")}</label>}
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => handleLineChange(index, "quantity", e.target.value)}
                  placeholder={t("transactions.qty")}
                  style={s.input}
                />
              </div>
              <div style={{ paddingTop: index === 0 ? 22 : 0 }}>
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  style={s.btnRemove}
                  disabled={lines.length === 1}
                  title={t("transactions.remove")}
                >
                  {t("transactions.remove")}
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addLine} style={s.btnAddLine}>
            {t("transactions.addLine")}
          </button>

          <div style={s.formFooter}>
            <button type="submit" style={s.btnPrimary} disabled={submitting}>
              {submitting ? t("transactions.submitting") : t("transactions.create")}
            </button>
          </div>
        </form>
      </div>

      {/* Transactions list */}
      <div style={s.card}>
        <div style={s.tableHeader}>
          <p style={{ ...s.sectionTitle, marginBottom: 0 }}>{t("transactions.listTitle")}</p>
          <span style={s.badge2}>{listTotal}</span>
        </div>

        {/* Filters */}
        <div style={s.filterRow}>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as TransactionType | ""); setListPage(1); }}
            style={{ ...s.select, flex: 1 }}
          >
            <option value="">{t("transactions.allTypes")}</option>
            <option value={TransactionType.DEBIT}>{TransactionType.DEBIT}</option>
            <option value={TransactionType.CREDIT}>{TransactionType.CREDIT}</option>
          </select>
          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value as SourceType | ""); setListPage(1); }}
            style={{ ...s.select, flex: 1 }}
          >
            <option value="">{t("transactions.allSources")}</option>
            <option value={SourceType.SALES}>{SourceType.SALES}</option>
            <option value={SourceType.DEFECT}>{SourceType.DEFECT}</option>
            <option value={SourceType.BATCH}>{SourceType.BATCH}</option>
          </select>
        </div>

        {listLoading ? (
          <p style={s.emptyText}>{t("common.loading")}</p>
        ) : txns.length === 0 ? (
          <p style={s.emptyText}>{t("transactions.emptyList")}</p>
        ) : (
          <>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t("common.id")}</th>
                  <th style={s.th}>{t("common.date")}</th>
                  <th style={s.th}>{t("transactions.typeHeader")}</th>
                  <th style={s.th}>{t("transactions.sourceHeader")}</th>
                  <th style={s.th}>{t("transactions.sourceId")}</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((txn) => (
                  <tr key={txn.id}>
                    <td style={s.td}>#{txn.id}</td>
                    <td style={s.td}>{txn.transaction_date}</td>
                    <td style={s.td}>
                      <span style={s.badge(txn.transaction_type)}>{txn.transaction_type}</span>
                    </td>
                    <td style={s.td}>{txn.source_type}</td>
                    <td style={s.td}>{txn.source_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {listTotalPages > 1 && (
              <div style={s.pagination}>
                <button
                  style={listPage <= 1 ? s.pageBtnDisabled : s.pageBtn}
                  onClick={() => setListPage((p) => p - 1)}
                  disabled={listPage <= 1}
                >
                  {t("common.previous")}
                </button>
                <span>{t("common.pageOf", { page: listPage, total: listTotalPages })}</span>
                <button
                  style={listPage >= listTotalPages ? s.pageBtnDisabled : s.pageBtn}
                  onClick={() => setListPage((p) => p + 1)}
                  disabled={listPage >= listTotalPages}
                >
                  {t("common.next")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
