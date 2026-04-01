import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { confirmBatch, createBatch, listBatches, updateBatch } from "../api/batches";
import { listProducts } from "../api/products";
import type { Batch, BatchCreate, BatchUpdate, Product } from "../types";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  page: {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    padding: "32px 24px",
    color: "#1a1a2e",
  } as React.CSSProperties,

  heading: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 24,
    letterSpacing: "-0.5px",
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 12,
    color: "#374151",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  } as React.CSSProperties,

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 28,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  } as React.CSSProperties,

  // Form
  form: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
    alignItems: "flex-end",
  } as React.CSSProperties,

  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 140,
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  input: {
    padding: "7px 10px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    outline: "none",
    background: "#f9fafb",
    color: "#111827",
    width: "100%",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  // Buttons
  btnPrimary: {
    padding: "7px 18px",
    fontSize: 14,
    fontWeight: 600,
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    transition: "background 0.15s",
    alignSelf: "flex-end",
    height: 36,
  } as React.CSSProperties,

  btnSecondary: {
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 500,
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    cursor: "pointer",
  } as React.CSSProperties,

  btnDanger: {
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 500,
    background: "#fff0f0",
    color: "#dc2626",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    cursor: "pointer",
  } as React.CSSProperties,

  btnSuccess: {
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 500,
    background: "#ecfdf5",
    color: "#059669",
    border: "1px solid #6ee7b7",
    borderRadius: 6,
    cursor: "pointer",
  } as React.CSSProperties,

  // Table
  tableWrapper: {
    overflowX: "auto" as const,
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
  } as React.CSSProperties,

  th: {
    textAlign: "left" as const,
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "2px solid #e5e7eb",
    background: "#f9fafb",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "10px 14px",
    borderBottom: "1px solid #f3f4f6",
    color: "#374151",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,

  trHover: {
    background: "#f9fafb",
  } as React.CSSProperties,

  badge: (confirmed: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 999,
    background: confirmed ? "#d1fae5" : "#fef3c7",
    color: confirmed ? "#065f46" : "#92400e",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  }),

  // Inline edit input
  inlineInput: {
    padding: "4px 8px",
    fontSize: 14,
    border: "1px solid #818cf8",
    borderRadius: 5,
    outline: "none",
    width: 110,
    background: "#fff",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  // Pagination
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    justifyContent: "flex-end",
  } as React.CSSProperties,

  pageInfo: {
    fontSize: 13,
    color: "#6b7280",
  } as React.CSSProperties,

  // Feedback banners
  banner: (type: "success" | "error"): React.CSSProperties => ({
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
    background: type === "success" ? "#ecfdf5" : "#fef2f2",
    color: type === "success" ? "#065f46" : "#991b1b",
    border: `1px solid ${type === "success" ? "#a7f3d0" : "#fecaca"}`,
    fontWeight: 500,
  }),
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EditState {
  batch_date: string;
  product_id: string;
  quantity: string;
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: BatchCreate = {
  batch_date: todayIso(),
  product_id: 0,
  quantity: 1,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("size")) || 10;

  // List state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Loading / feedback
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create form
  const [form, setForm] = useState<BatchCreate>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    batch_date: "",
    product_id: "",
    quantity: "",
  });
  const [saving, setSaving] = useState(false);

  // Product list for dropdown
  const [products, setProducts] = useState<Product[]>([]);

  // Confirm state
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // Row hover tracking
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBatches(page, pageSize);
      setBatches(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch (err: unknown) {
      showFeedback("error", extractMessage(err, "Failed to load batches."));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchBatches();
    listProducts(1, 100).then((res) => setProducts(res.items)).catch(() => {});
  }, [fetchBatches]);

  // -------------------------------------------------------------------------
  // Feedback helper
  // -------------------------------------------------------------------------
  function showFeedback(type: "success" | "error", message: string) {
    setFeedback({ type, message });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 5000);
  }

  function extractMessage(err: unknown, fallback: string): string {
    if (
      err &&
      typeof err === "object" &&
      "response" in err &&
      (err as { response?: { data?: { detail?: unknown } } }).response?.data
        ?.detail
    ) {
      const detail = (err as { response: { data: { detail: unknown } } })
        .response.data.detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? String(d)).join("; ");
    }
    if (err instanceof Error) return err.message;
    return fallback;
  }

  // -------------------------------------------------------------------------
  // Create batch
  // -------------------------------------------------------------------------
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_id || form.quantity < 1) {
      showFeedback("error", "Product ID and quantity (≥ 1) are required.");
      return;
    }
    setCreating(true);
    try {
      await createBatch(form);
      showFeedback("success", "Batch created successfully.");
      setForm(EMPTY_FORM);
      await fetchBatches();
    } catch (err: unknown) {
      showFeedback("error", extractMessage(err, "Failed to create batch."));
    } finally {
      setCreating(false);
    }
  }

  // -------------------------------------------------------------------------
  // Inline edit
  // -------------------------------------------------------------------------
  function startEdit(batch: Batch) {
    setEditingId(batch.id);
    setEditState({
      batch_date: batch.batch_date,
      product_id: String(batch.product_id),
      quantity: String(batch.quantity),
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(batchId: number) {
    const payload: BatchUpdate = {};
    if (editState.batch_date) payload.batch_date = editState.batch_date;
    if (editState.product_id) payload.product_id = Number(editState.product_id);
    if (editState.quantity) payload.quantity = Number(editState.quantity);

    if (payload.quantity !== undefined && payload.quantity < 1) {
      showFeedback("error", "Quantity must be at least 1.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateBatch(batchId, payload);
      setBatches((prev) => prev.map((b) => (b.id === batchId ? updated : b)));
      setEditingId(null);
      showFeedback("success", `Batch #${batchId} updated.`);
    } catch (err: unknown) {
      showFeedback("error", extractMessage(err, "Failed to update batch."));
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Confirm batch
  // -------------------------------------------------------------------------
  async function handleConfirm(batchId: number) {
    setConfirmingId(batchId);
    try {
      const confirmed = await confirmBatch(batchId);
      setBatches((prev) => prev.map((b) => (b.id === batchId ? confirmed : b)));
      showFeedback("success", `Batch #${batchId} confirmed.`);
    } catch (err: unknown) {
      showFeedback("error", extractMessage(err, "Failed to confirm batch."));
    } finally {
      setConfirmingId(null);
    }
  }

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------
  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setSearchParams({ page: String(p), size: String(pageSize) });
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  function renderEditRow(batch: Batch) {
    return (
      <tr key={batch.id} style={{ background: "#eef2ff" }}>
        <td style={S.td}>{batch.id}</td>
        <td style={S.td}>
          <input
            type="date"
            style={S.inlineInput}
            value={editState.batch_date}
            onChange={(e) =>
              setEditState((s) => ({ ...s, batch_date: e.target.value }))
            }
          />
        </td>
        <td style={S.td}>
          <select
            style={{ ...S.inlineInput, width: 160 }}
            value={editState.product_id}
            onChange={(e) =>
              setEditState((s) => ({ ...s, product_id: e.target.value }))
            }
          >
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku_code})
              </option>
            ))}
          </select>
        </td>
        <td style={S.td}>
          <input
            type="number"
            style={{ ...S.inlineInput, width: 90 }}
            value={editState.quantity}
            min={1}
            onChange={(e) =>
              setEditState((s) => ({ ...s, quantity: e.target.value }))
            }
          />
        </td>
        <td style={S.td}>—</td>
        <td style={S.td}>
          <span style={S.badge(batch.is_confirmed)}>
            {batch.is_confirmed ? "Confirmed" : "Pending"}
          </span>
        </td>
        <td style={{ ...S.td, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            style={S.btnSuccess}
            onClick={() => saveEdit(batch.id)}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button style={S.btnDanger} onClick={cancelEdit} disabled={saving}>
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  function renderRow(batch: Batch) {
    const isHovered = hoveredRow === batch.id;
    const canEdit = !batch.is_confirmed;

    return (
      <tr
        key={batch.id}
        style={isHovered ? { ...S.trHover } : {}}
        onMouseEnter={() => setHoveredRow(batch.id)}
        onMouseLeave={() => setHoveredRow(null)}
      >
        <td style={{ ...S.td, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
          #{batch.id}
        </td>
        <td style={S.td}>{formatDate(batch.batch_date)}</td>
        <td style={S.td}>
          {products.find((p) => p.id === batch.product_id)?.name ?? `#${batch.product_id}`}
        </td>
        <td style={{ ...S.td, fontVariantNumeric: "tabular-nums" }}>
          {batch.quantity.toLocaleString()}
        </td>
        <td style={{ ...S.td, color: "#9ca3af", fontSize: 13 }}>
          {formatDate(batch.created_at)}
        </td>
        <td style={S.td}>
          <span style={S.badge(batch.is_confirmed)}>
            {batch.is_confirmed ? "Confirmed" : "Pending"}
          </span>
        </td>
        <td style={S.td}>
          {canEdit && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                style={{
                  ...S.btnSecondary,
                  opacity: isHovered ? 1 : 0.4,
                  transition: "opacity 0.15s",
                }}
                onClick={() => startEdit(batch)}
              >
                Edit
              </button>
              <button
                style={{
                  ...S.btnPrimary,
                  padding: "5px 12px",
                  fontSize: 13,
                  opacity: isHovered ? 1 : 0.4,
                  transition: "opacity 0.15s",
                }}
                onClick={() => handleConfirm(batch.id)}
                disabled={confirmingId === batch.id}
              >
                {confirmingId === batch.id ? "Confirming..." : "Confirm"}
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={S.page}>
      <h1 style={S.heading}>Batches</h1>

      {/* Feedback banner */}
      {feedback && (
        <div style={S.banner(feedback.type)}>{feedback.message}</div>
      )}

      {/* Create form */}
      <div style={S.card}>
        <p style={S.sectionTitle}>New Batch</p>
        <form onSubmit={handleCreate} style={S.form}>
          <div style={S.fieldGroup}>
            <label style={S.label} htmlFor="batch_date">
              Batch Date
            </label>
            <input
              id="batch_date"
              type="date"
              style={S.input}
              value={form.batch_date}
              required
              onChange={(e) =>
                setForm((f) => ({ ...f, batch_date: e.target.value }))
              }
            />
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label} htmlFor="product_id">
              Product
            </label>
            <select
              id="product_id"
              style={S.input}
              value={form.product_id === 0 ? "" : form.product_id}
              required
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  product_id: e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku_code})
                </option>
              ))}
            </select>
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label} htmlFor="quantity">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              style={S.input}
              value={form.quantity}
              min={1}
              required
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: Number(e.target.value) }))
              }
            />
          </div>

          <button type="submit" style={S.btnPrimary} disabled={creating}>
            {creating ? "Creating…" : "Create Batch"}
          </button>
        </form>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <p style={{ ...S.sectionTitle, marginBottom: 0 }}>
            Batch List{" "}
            {!loading && (
              <span
                style={{ color: "#9ca3af", fontSize: 12, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}
              >
                ({total} total)
              </span>
            )}
          </p>
          <button
            style={{ ...S.btnSecondary, fontSize: 12 }}
            onClick={() => fetchBatches(page)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div style={S.tableWrapper}>
          <table style={S.table}>
            <thead>
              <tr>
                {["ID", "Batch Date", "Product", "Quantity", "Created At", "Status", ""].map(
                  (col) => (
                    <th key={col} style={S.th}>
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading && batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 32 }}
                  >
                    Loading…
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ ...S.td, textAlign: "center", color: "#9ca3af", padding: 32 }}
                  >
                    No batches found.
                  </td>
                </tr>
              ) : (
                batches.map((batch) =>
                  editingId === batch.id
                    ? renderEditRow(batch)
                    : renderRow(batch)
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={S.pagination}>
          <span style={S.pageInfo}>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13, color: "#6b7280" }}>
              Per page:
              <select
                style={{ ...S.input, width: "auto", marginLeft: 4, padding: "4px 8px", fontSize: 13 }}
                value={pageSize}
                onChange={(e) => setSearchParams({ page: "1", size: e.target.value })}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              style={S.btnSecondary}
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              ← Previous
            </button>
            <button
              style={S.btnSecondary}
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
