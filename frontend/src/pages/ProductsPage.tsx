import { useCallback, useEffect, useState } from "react";
import { createProduct, listProducts, updateProduct } from "../api/products";
import type { Product } from "../types";

interface EditState {
  name: string;
  sku_code: string;
}

export default function ProductsPage() {
  const [name, setName] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // List state
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Per-row editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", sku_code: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listProducts(page, 10, search || undefined);
      setProducts(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch {
      setErrorMsg("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedSku = skuCode.trim();

    if (!trimmedName || !trimmedSku) {
      setErrorMsg("Both name and SKU code are required.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createProduct({ name: trimmedName, sku_code: trimmedSku });
      setSuccessMsg(`Product "${created.name}" created successfully.`);
      setName("");
      setSkuCode("");
      fetchProducts();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to create product. Please try again.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditState({ name: product.name, sku_code: product.sku_code });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ name: "", sku_code: "" });
    setEditError(null);
  }

  async function handleUpdate(productId: number) {
    const trimmedName = editState.name.trim();
    const trimmedSku = editState.sku_code.trim();

    if (!trimmedName || !trimmedSku) {
      setEditError("Both name and SKU code are required.");
      return;
    }

    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateProduct(productId, {
        name: trimmedName,
        sku_code: trimmedSku,
      });
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setEditingId(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update product. Please try again.";
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      maxWidth: 760,
      margin: "0 auto",
      padding: "40px 24px",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#111",
    },
    heading: { fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.3px" },
    subheading: { fontSize: 14, color: "#6b7280", marginBottom: 32 },
    card: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "28px 28px 24px",
      marginBottom: 32,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    },
    cardTitle: { fontSize: 15, fontWeight: 600, marginBottom: 20, color: "#374151" },
    formRow: { display: "flex", gap: 12, flexWrap: "wrap" as const, alignItems: "flex-end" },
    fieldGroup: { display: "flex", flexDirection: "column" as const, gap: 6, flex: 1, minWidth: 160 },
    label: { fontSize: 13, fontWeight: 500, color: "#374151" },
    input: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      fontSize: 14,
      outline: "none",
      background: "#fff",
      color: "#111",
    },
    btnPrimary: {
      padding: "9px 20px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
      alignSelf: "flex-end",
      flexShrink: 0,
    },
    btnPrimaryDisabled: {
      padding: "9px 20px",
      background: "#93c5fd",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      cursor: "not-allowed",
      whiteSpace: "nowrap" as const,
      alignSelf: "flex-end",
      flexShrink: 0,
    },
    alertSuccess: {
      marginTop: 16,
      padding: "10px 14px",
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: 6,
      fontSize: 13,
      color: "#15803d",
    },
    alertError: {
      marginTop: 16,
      padding: "10px 14px",
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: 6,
      fontSize: 13,
      color: "#dc2626",
    },
    tableCard: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    },
    tableHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 20px",
      borderBottom: "1px solid #e5e7eb",
    },
    tableTitle: { fontSize: 15, fontWeight: 600, color: "#374151" },
    badge: {
      background: "#eff6ff",
      color: "#2563eb",
      fontSize: 12,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 12,
    },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: {
      textAlign: "left" as const,
      fontSize: 12,
      fontWeight: 600,
      color: "#6b7280",
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      padding: "10px 20px",
      background: "#f9fafb",
      borderBottom: "1px solid #e5e7eb",
    },
    td: {
      padding: "12px 20px",
      fontSize: 14,
      color: "#374151",
      borderBottom: "1px solid #f3f4f6",
      verticalAlign: "middle" as const,
    },
    inlineInput: {
      padding: "5px 8px",
      border: "1px solid #93c5fd",
      borderRadius: 5,
      fontSize: 14,
      outline: "none",
      background: "#eff6ff",
      color: "#111",
      width: "100%",
      boxSizing: "border-box" as const,
    },
    actionGroup: { display: "flex", gap: 8 },
    btnEdit: {
      padding: "5px 12px",
      background: "transparent",
      color: "#2563eb",
      border: "1px solid #bfdbfe",
      borderRadius: 5,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
    },
    btnSave: {
      padding: "5px 12px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 5,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
    },
    btnCancel: {
      padding: "5px 12px",
      background: "transparent",
      color: "#6b7280",
      border: "1px solid #e5e7eb",
      borderRadius: 5,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
    },
    emptyState: { padding: "40px 20px", textAlign: "center" as const, color: "#9ca3af", fontSize: 14 },
    pagination: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 20px",
      borderTop: "1px solid #e5e7eb",
      fontSize: 13,
      color: "#6b7280",
    },
    pageBtn: {
      padding: "5px 14px",
      background: "#fff",
      color: "#374151",
      border: "1px solid #d1d5db",
      borderRadius: 5,
      fontSize: 13,
      cursor: "pointer",
    },
    pageBtnDisabled: {
      padding: "5px 14px",
      background: "#f9fafb",
      color: "#d1d5db",
      border: "1px solid #e5e7eb",
      borderRadius: 5,
      fontSize: 13,
      cursor: "not-allowed",
    },
    searchRow: {
      display: "flex",
      gap: 8,
      marginBottom: 16,
      alignItems: "center",
    },
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Products</h1>
      <p style={styles.subheading}>Create and manage your product catalog.</p>

      {/* Create form */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Add New Product</div>
        <form onSubmit={handleCreate} noValidate>
          <div style={styles.formRow}>
            <div style={styles.fieldGroup}>
              <label htmlFor="product-name" style={styles.label}>Product Name</label>
              <input
                id="product-name"
                type="text"
                placeholder="e.g. Red Brick Standard"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                disabled={submitting}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label htmlFor="sku-code" style={styles.label}>SKU Code</label>
              <input
                id="sku-code"
                type="text"
                placeholder="e.g. RB-001"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
                style={styles.input}
                disabled={submitting}
              />
            </div>
            <button
              type="submit"
              style={submitting ? styles.btnPrimaryDisabled : styles.btnPrimary}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Product"}
            </button>
          </div>

          {successMsg && <div style={styles.alertSuccess}>{successMsg}</div>}
          {errorMsg && <div style={styles.alertError}>{errorMsg}</div>}
        </form>
      </div>

      {/* Product list */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <span style={styles.tableTitle}>All Products</span>
          <span style={styles.badge}>{total}</span>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px 0" }}>
          <form onSubmit={handleSearch} style={styles.searchRow}>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />
            <button type="submit" style={styles.btnPrimary}>Search</button>
            {search && (
              <button
                type="button"
                style={styles.btnCancel}
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : products.length === 0 ? (
          <div style={styles.emptyState}>
            {search ? "No products match your search." : "No products yet. Create one above."}
          </div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>SKU Code</th>
                  <th style={{ ...styles.th, width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isEditing = editingId === product.id;
                  return (
                    <tr key={product.id}>
                      <td style={styles.td}>
                        <span style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: 13 }}>
                          #{product.id}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editState.name}
                            onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                            style={styles.inlineInput}
                            disabled={editSubmitting}
                            autoFocus
                          />
                        ) : (
                          product.name
                        )}
                      </td>

                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editState.sku_code}
                            onChange={(e) => setEditState((s) => ({ ...s, sku_code: e.target.value }))}
                            style={styles.inlineInput}
                            disabled={editSubmitting}
                          />
                        ) : (
                          <span style={{ fontFamily: "monospace", background: "#f3f4f6", padding: "2px 7px", borderRadius: 4, fontSize: 13 }}>
                            {product.sku_code}
                          </span>
                        )}
                      </td>

                      <td style={styles.td}>
                        {isEditing ? (
                          <div>
                            <div style={styles.actionGroup}>
                              <button
                                style={editSubmitting ? { ...styles.btnSave, opacity: 0.6, cursor: "not-allowed" } : styles.btnSave}
                                onClick={() => handleUpdate(product.id)}
                                disabled={editSubmitting}
                              >
                                {editSubmitting ? "Saving..." : "Save"}
                              </button>
                              <button style={styles.btnCancel} onClick={cancelEdit} disabled={editSubmitting}>
                                Cancel
                              </button>
                            </div>
                            {editError && (
                              <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>{editError}</div>
                            )}
                          </div>
                        ) : (
                          <button
                            style={styles.btnEdit}
                            onClick={() => startEdit(product)}
                            disabled={editingId !== null}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  style={page <= 1 ? styles.pageBtnDisabled : styles.pageBtn}
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  style={page >= totalPages ? styles.pageBtnDisabled : styles.pageBtn}
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
