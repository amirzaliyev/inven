import { useState } from "react";
import { createInventoryTransaction } from "../api/inventory-transactions";
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
  const [form, setForm] = useState(initialForm);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [created, setCreated] = useState<InventoryTransaction[]>([]);

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
      setFeedback({ type: "error", message: "Transaction date is required." });
      return;
    }
    if (!form.source_id || isNaN(Number(form.source_id))) {
      setFeedback({ type: "error", message: "Source ID must be a valid number." });
      return;
    }
    if (lines.length === 0) {
      setFeedback({ type: "error", message: "At least one line item is required." });
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.product_id || isNaN(Number(l.product_id))) {
        setFeedback({ type: "error", message: `Line ${i + 1}: product ID must be a valid number.` });
        return;
      }
      if (!l.quantity || isNaN(Number(l.quantity)) || Number(l.quantity) <= 0) {
        setFeedback({ type: "error", message: `Line ${i + 1}: quantity must be a positive number.` });
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
      setCreated((prev) => [result, ...prev]);
      setForm(initialForm);
      setLines([emptyLine()]);
      setFeedback({ type: "success", message: `Transaction #${result.id} created successfully.` });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "An unexpected error occurred.";
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
  };

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Inventory Transactions</h1>

      {/* Form card */}
      <div style={s.card}>
        <p style={s.sectionTitle}>New Transaction</p>

        {feedback && <div style={s.feedback(feedback.type)}>{feedback.message}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {/* Row 1: date + transaction_type */}
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label} htmlFor="transaction_date">Transaction Date</label>
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
              <label style={s.label} htmlFor="transaction_type">Transaction Type</label>
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

          {/* Row 2: source_type + source_id */}
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label} htmlFor="source_type">Source Type</label>
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
              <label style={s.label} htmlFor="source_id">Source ID</label>
              <input
                id="source_id"
                name="source_id"
                type="number"
                min={1}
                value={form.source_id}
                onChange={handleFieldChange}
                placeholder="e.g. 42"
                style={s.input}
                required
              />
            </div>
          </div>

          {/* Lines section */}
          <div style={s.divider} />
          <p style={s.sectionTitle}>Line Items</p>

          {lines.map((line, index) => (
            <div key={index} style={s.lineRow}>
              <div style={s.field}>
                {index === 0 && <label style={s.label}>Product ID</label>}
                <input
                  type="number"
                  min={1}
                  value={line.product_id}
                  onChange={(e) => handleLineChange(index, "product_id", e.target.value)}
                  placeholder="Product ID"
                  style={s.input}
                />
              </div>
              <div style={s.field}>
                {index === 0 && <label style={s.label}>Quantity</label>}
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => handleLineChange(index, "quantity", e.target.value)}
                  placeholder="Qty"
                  style={s.input}
                />
              </div>
              <div style={{ paddingTop: index === 0 ? 22 : 0 }}>
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  style={s.btnRemove}
                  disabled={lines.length === 1}
                  title="Remove line"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addLine} style={s.btnAddLine}>
            + Add Line
          </button>

          <div style={s.formFooter}>
            <button type="submit" style={s.btnPrimary} disabled={submitting}>
              {submitting ? "Submitting..." : "Create Transaction"}
            </button>
          </div>
        </form>
      </div>

      {/* Session history */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Created This Session</p>

        {created.length === 0 ? (
          <p style={s.emptyText}>No transactions created yet.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>ID</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Source</th>
                <th style={s.th}>Source ID</th>
                <th style={s.th}>Lines</th>
              </tr>
            </thead>
            <tbody>
              {created.map((txn) => (
                <tr key={txn.id}>
                  <td style={s.td}>#{txn.id}</td>
                  <td style={s.td}>{txn.transaction_date}</td>
                  <td style={s.td}>
                    <span style={s.badge(txn.transaction_type)}>{txn.transaction_type}</span>
                  </td>
                  <td style={s.td}>{txn.source_type}</td>
                  <td style={s.td}>{txn.source_id}</td>
                  <td style={s.td}>
                    {txn.lines.map((l, i) => (
                      <div key={i} style={{ whiteSpace: "nowrap" }}>
                        Product {l.product_id} &times; {l.quantity}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
