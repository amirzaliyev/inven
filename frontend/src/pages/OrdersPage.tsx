import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../utils/date";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { DateInput } from "../components/DateInput";
import { Modal } from "../components/Modal";
import { AsyncSelect } from "../components/AsyncSelect";
import {
  PageHead,
  Button,
  FilterChip,
  ListCard,
  EmptyState,
  StatusPill,
  BottomSheet,
  fmtMoney,
  fmtNum,
  type StatusVariant,
} from "../components/ui";
import {
  cancelOrder,
  completeOrder,
  createOrder,
  listOrders,
  resetOrder,
  updateOrder,
} from "../api/orders";
import { listCustomers } from "../api/customers";
import { listProducts } from "../api/products";
import type { Order, OrderItemCreate, OrderStatus } from "../types";
import { OrderStatus as OS } from "../types";

interface FormItem {
  product_id: number | "";
  product_label?: string;
  quantity: number | "";
  price: number | "";
}

interface FormState {
  order_date: string;
  customer_id: number | "";
  items: FormItem[];
}

const emptyItem = (): FormItem => ({ product_id: "", quantity: "", price: "" });
const todayStr = () => new Date().toISOString().slice(0, 10);

function statusVariant(status: OrderStatus): StatusVariant {
  switch (status) {
    case OS.COMPLETED: return "success";
    case OS.DRAFT: return "warn";
    case OS.CANCELLED: return "danger";
    default: return "info";
  }
}

function statusAvatarCls(variant: StatusVariant): string {
  switch (variant) {
    case "success": return "bg-green-100 text-green-800";
    case "info":    return "bg-blue-100 text-blue-800";
    case "warn":    return "bg-amber-100 text-amber-800";
    case "danger":  return "bg-red-100 text-red-800";
    default:        return "bg-bluegray-100 text-bluegray-700";
  }
}

type StatusFilter = "all" | "DRAFT" | "COMPLETED" | "CANCELLED";

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();

  // Permissions: keep simple — assume write enabled (matches previous behavior, no AuthContext gate present in original)
  const canWriteOrders = true;

  const [form, setForm] = useState<FormState>({ order_date: todayStr(), customer_id: "", items: [emptyItem()] });
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ order_date: todayStr(), customer_id: "", items: [emptyItem()] });
  const [editCustomerName, setEditCustomerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const SIZE = 15;
  const [loadingList, setLoadingList] = useState(false);

  const [filterCustomer, setFilterCustomer] = useState<number | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<string>("");
  const [sheetOrder, setSheetOrder] = useState<Order | null>(null);

  const fetchCustomerOptions = useCallback(
    (q: string) => listCustomers(1, 50, q || undefined).then((r) => r.items.map((c) => ({ value: c.id, label: c.full_name }))),
    []
  );

  const fetchProductOptions = useCallback(
    (q: string) => listProducts(1, 50, q || undefined).then((r) => r.items.map((p) => ({ value: p.id, label: `${p.name} (${p.sku_code})` }))),
    []
  );

  const loadOrders = useCallback(async (pg = page) => {
    setLoadingList(true);
    try {
      const res = await listOrders({
        page: pg,
        size: SIZE,
        customer_id: filterCustomer || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      setOrders(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      toast("error", t("orders.loadError"));
    } finally {
      setLoadingList(false);
    }
  }, [page, filterCustomer, filterDateFrom, filterDateTo, t]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  function statusLabel(status: OrderStatus): string {
    if (status === OS.DRAFT) return t("orders.statusDraft");
    if (status === OS.COMPLETED) return t("orders.statusCompleted");
    if (status === OS.CANCELLED) return t("orders.statusCancelled");
    return String(status);
  }

  function validateForm(f: FormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!f.order_date) errs.order_date = t("orders.validationDate");
    if (!f.customer_id) errs.customer_id = t("orders.validationCustomer");
    for (let i = 0; i < f.items.length; i++) {
      const n = i + 1;
      if (!f.items[i].product_id) errs[`item_${i}_product`] = t("orders.validationItemProduct", { n });
      if (!f.items[i].quantity || Number(f.items[i].quantity) < 1) errs[`item_${i}_qty`] = t("orders.validationItemQty", { n });
      if (!f.items[i].price || Number(f.items[i].price) <= 0) errs[`item_${i}_price`] = t("orders.validationItemPrice", { n });
    }
    return errs;
  }

  function openCreate() {
    setForm({ order_date: todayStr(), customer_id: "", items: [emptyItem()] });
    setCreateErrors({});
    setShowCreateModal(true);
  }

  async function handleCreate() {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }
    setCreateErrors({});
    setCreating(true);
    try {
      const payload = {
        order_date: form.order_date,
        customer_id: form.customer_id as number,
        items: form.items.map((it) => ({
          product_id: it.product_id as number,
          quantity: Number(it.quantity),
          price: Number(it.price),
        })) as OrderItemCreate[],
      };
      const created = await createOrder(payload);
      toast("success", t("orders.createSuccess", { id: created.id }));
      setForm({ order_date: todayStr(), customer_id: "", items: [emptyItem()] });
      setShowCreateModal(false);
      setPage(1);
      loadOrders(1);
    } catch {
      setCreateErrors({ api: t("orders.createError") });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(order: Order) {
    setEditId(order.id);
    setEditCustomerName(order.customer?.full_name ?? "");
    setEditForm({
      order_date: order.order_date,
      customer_id: order.customer_id,
      items: order.items.map((it) => ({
        product_id: it.product.id,
        product_label: `${it.product.name} (${it.product.sku_code})`,
        quantity: it.quantity,
        price: Number(it.price),
      })),
    });
  }

  async function handleSave() {
    if (!editId) return;
    const errs = validateForm(editForm);
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditErrors({});
    setSaving(true);
    try {
      const payload = {
        order_date: editForm.order_date,
        customer_id: editForm.customer_id as number,
        items: editForm.items.map((it) => ({
          product_id: it.product_id as number,
          quantity: Number(it.quantity),
          price: Number(it.price),
        })) as OrderItemCreate[],
      };
      const updated = await updateOrder(editId, payload);
      toast("success", t("orders.updateSuccess", { id: updated.id }));
      setEditId(null);
      loadOrders();
    } catch {
      setEditErrors({ api: t("orders.updateError") });
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(orderId: number, action: "complete" | "cancel" | "reset") {
    const confirmKey = action === "complete" ? "orders.completeConfirm" : action === "cancel" ? "orders.cancelConfirm" : "orders.resetConfirm";
    const ok = await confirm({ message: t(confirmKey), danger: action === "cancel" });
    if (!ok) return;
    setActionId(orderId);
    setActionType(action);
    try {
      if (action === "complete") await completeOrder(orderId);
      else if (action === "cancel") await cancelOrder(orderId);
      else await resetOrder(orderId);
      setSheetOrder(null);
      loadOrders();
    } catch {
      alert(t("orders.actionError"));
    } finally {
      setActionId(null);
      setActionType("");
    }
  }

  function updateFormItem(f: FormState, setF: (v: FormState) => void, idx: number, key: keyof FormItem, val: string, errors?: Record<string, string>, setErrors?: (v: Record<string, string>) => void) {
    const items = f.items.map((it, i) => i === idx ? { ...it, [key]: val === "" ? "" : key === "product_id" ? Number(val) : val } : it);
    setF({ ...f, items });
    if (errors && setErrors) {
      const errKey = key === "product_id" ? `item_${idx}_product` : key === "quantity" ? `item_${idx}_qty` : `item_${idx}_price`;
      if (errors[errKey]) {
        const next = { ...errors };
        delete next[errKey];
        setErrors(next);
      }
    }
  }

  function updateFormProduct(f: FormState, setF: (v: FormState) => void, idx: number, productId: number | "", productLabel: string | undefined, errors?: Record<string, string>, setErrors?: (v: Record<string, string>) => void) {
    const items = f.items.map((it, i) =>
      i === idx ? { ...it, product_id: productId, product_label: productLabel } : it,
    );
    setF({ ...f, items });
    if (errors && setErrors && errors[`item_${idx}_product`]) {
      const next = { ...errors };
      delete next[`item_${idx}_product`];
      setErrors(next);
    }
  }

  function addItem(f: FormState, setF: (v: FormState) => void) {
    setF({ ...f, items: [...f.items, emptyItem()] });
  }

  function removeItem(f: FormState, setF: (v: FormState) => void, idx: number) {
    setF({ ...f, items: f.items.filter((_, i) => i !== idx) });
  }

  function calcTotal(items: FormItem[]) {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
  }

  function renderItemsForm(f: FormState, setF: (v: FormState) => void, errors: Record<string, string>, setErrors: (v: Record<string, string>) => void) {
    return (
      <div className="mt-3">
        <div className="hidden md:grid grid-cols-[1fr_6rem_6rem_1.75rem] gap-2 mb-1 px-0.5">
          <span className="text-xs font-semibold text-bluegray-400 uppercase tracking-wider">{t("common.product")}</span>
          <span className="text-xs font-semibold text-bluegray-400 uppercase tracking-wider">{t("common.quantity")}</span>
          <span className="text-xs font-semibold text-bluegray-400 uppercase tracking-wider">{t("orders.price")}</span>
          <span />
        </div>
        <div className="space-y-2">
          {f.items.map((it, idx) => (
            <div key={idx}>
              <div className="flex flex-wrap md:grid md:grid-cols-[1fr_6rem_6rem_1.75rem] gap-2 items-center">
                <div className="w-full min-w-0">
                  <AsyncSelect
                    value={it.product_id}
                    onChange={(v, opt) => updateFormProduct(f, setF, idx, v, opt?.label, errors, setErrors)}
                    fetchOptions={fetchProductOptions}
                    displayValue={it.product_label}
                    placeholder={t("common.selectProduct")}
                    className={`input${errors[`item_${idx}_product`] ? " !border-red-400" : ""}`}
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => updateFormItem(f, setF, idx, "quantity", e.target.value, errors, setErrors)}
                  placeholder={t("common.quantity")}
                  className={`input flex-1 md:flex-none md:w-full min-w-0${errors[`item_${idx}_qty`] ? " !border-red-400" : ""}`}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.price}
                  onChange={(e) => updateFormItem(f, setF, idx, "price", e.target.value, errors, setErrors)}
                  placeholder={t("orders.price")}
                  className={`input flex-1 md:flex-none md:w-full min-w-0${errors[`item_${idx}_price`] ? " !border-red-400" : ""}`}
                />
                {f.items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItem(f, setF, idx)}
                    className="icon-btn icon-btn-danger"
                    aria-label="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : <span />}
              </div>
              <p className="text-xs text-red-500 min-h-4">{errors[`item_${idx}_product`] || errors[`item_${idx}_qty`] || errors[`item_${idx}_price`] || " "}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-bluegray-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addItem(f, setF)}
          >
            + {t("orders.addItem")}
          </Button>
          <span className="text-sm font-semibold text-bluegray-700">
            {t("orders.totalAmount")}: {fmtMoney(calcTotal(f.items))}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHead
        title={t("orders.title")}
        subtitle={t("orders.subtitle")}
        actions={canWriteOrders && <Button onClick={openCreate}>{t("orders.addNew")}</Button>}
      />

      {/* Status filter chips */}
      <div className="chip-row">
        <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          {t("common.all", { defaultValue: "All" })}
        </FilterChip>
        <FilterChip active={statusFilter === "DRAFT"} onClick={() => setStatusFilter("DRAFT")}>
          {t("orders.statusDraft")}
        </FilterChip>
        <FilterChip active={statusFilter === "COMPLETED"} onClick={() => setStatusFilter("COMPLETED")}>
          {t("orders.statusCompleted")}
        </FilterChip>
        <FilterChip active={statusFilter === "CANCELLED"} onClick={() => setStatusFilter("CANCELLED")}>
          {t("orders.statusCancelled")}
        </FilterChip>
      </div>

      {/* Secondary filters */}
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <AsyncSelect
          value={filterCustomer}
          onChange={(v) => { setFilterCustomer(v); setPage(1); }}
          fetchOptions={fetchCustomerOptions}
          placeholder={t("orders.filterCustomer")}
          clearable={true}
          className="input w-44"
        />
        <DateInput value={filterDateFrom} onChange={(v) => { setFilterDateFrom(v); setPage(1); }} className="input w-36" />
        <DateInput value={filterDateTo} onChange={(v) => { setFilterDateTo(v); setPage(1); }} className="input w-36" />
        {(filterCustomer !== "" || filterDateFrom || filterDateTo) && (
          <Button variant="outline" size="sm" onClick={() => { setFilterCustomer(""); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }}>
            {t("common.clear")}
          </Button>
        )}
        <span className="ml-auto text-xs text-bluegray-400">{total}</span>
      </div>

      {/* Create modal */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateErrors({}); setForm({ order_date: todayStr(), customer_id: "", items: [emptyItem()] }); }}
        title={t("orders.newOrder")}
        size="lg"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">{t("orders.orderDate")} <span className="text-red-400">*</span></label>
              <DateInput
                value={form.order_date}
                onChange={(v) => { setForm({ ...form, order_date: v }); if (createErrors.order_date) { const next = { ...createErrors }; delete next.order_date; setCreateErrors(next); } }}
                className={`input${createErrors.order_date ? " !border-red-400" : ""}`}
              />
              {createErrors.order_date && <span className="text-xs text-red-500">{createErrors.order_date}</span>}
            </div>
            <div className="field">
              <label className="field-label">{t("orders.customer")} <span className="text-red-400">*</span></label>
              <AsyncSelect
                value={form.customer_id}
                onChange={(v) => { setForm({ ...form, customer_id: v }); if (createErrors.customer_id) { const next = { ...createErrors }; delete next.customer_id; setCreateErrors(next); } }}
                fetchOptions={fetchCustomerOptions}
                placeholder={t("orders.selectCustomer")}
                className={`input${createErrors.customer_id ? " !border-red-400" : ""}`}
              />
              {createErrors.customer_id && <span className="text-xs text-red-500">{createErrors.customer_id}</span>}
            </div>
          </div>
          {renderItemsForm(form, setForm, createErrors, setCreateErrors)}
          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t border-bluegray-100">
            <Button variant="outline" onClick={() => { setShowCreateModal(false); setCreateErrors({}); setForm({ order_date: todayStr(), customer_id: "", items: [emptyItem()] }); }}>
              {t("orders.cancelEdit")}
            </Button>
            <Button disabled={creating} onClick={handleCreate}>
              {creating ? t("orders.creating") : t("orders.create")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editId !== null}
        onClose={() => { setEditId(null); setEditErrors({}); }}
        title={editId !== null ? t("orders.editTitle", { id: editId }) : ""}
        size="lg"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label className="field-label">{t("orders.orderDate")} <span className="text-red-400">*</span></label>
              <DateInput
                value={editForm.order_date}
                onChange={(v) => { setEditForm({ ...editForm, order_date: v }); if (editErrors.order_date) { const next = { ...editErrors }; delete next.order_date; setEditErrors(next); } }}
                className={`input${editErrors.order_date ? " !border-red-400" : ""}`}
              />
              {editErrors.order_date && <span className="text-xs text-red-500">{editErrors.order_date}</span>}
            </div>
            <div className="field">
              <label className="field-label">{t("orders.customer")} <span className="text-red-400">*</span></label>
              <AsyncSelect
                value={editForm.customer_id}
                onChange={(v) => { setEditForm({ ...editForm, customer_id: v }); setEditCustomerName(""); if (editErrors.customer_id) { const next = { ...editErrors }; delete next.customer_id; setEditErrors(next); } }}
                fetchOptions={fetchCustomerOptions}
                placeholder={t("orders.selectCustomer")}
                displayValue={editCustomerName || undefined}
                className={`input${editErrors.customer_id ? " !border-red-400" : ""}`}
              />
              {editErrors.customer_id && <span className="text-xs text-red-500">{editErrors.customer_id}</span>}
            </div>
          </div>
          {renderItemsForm(editForm, setEditForm, editErrors, setEditErrors)}
          {editErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t border-bluegray-100">
            <Button variant="outline" onClick={() => { setEditId(null); setEditErrors({}); }}>
              {t("orders.cancelEdit")}
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? t("orders.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* List */}
      {loadingList ? (
        <ListCard>
          <div className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</div>
        </ListCard>
      ) : visibleOrders.length === 0 ? (
        <EmptyState title={t("orders.emptyList")} />
      ) : (
        <>
          {/* Mobile: cards (tap → action sheet) */}
          <div className="md:hidden">
            <ListCard>
              {visibleOrders.map((order) => {
                const variant = statusVariant(order.status);
                return (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => setSheetOrder(order)}
                    className="row w-full text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${statusAvatarCls(variant)}`}>
                      #{order.id}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="text-sm font-semibold text-bluegray-900 truncate">
                        {order.customer?.full_name ?? "—"}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap text-xs text-bluegray-500 min-w-0">
                          <span>{formatDate(order.order_date, i18n.language)}</span>
                          <span>·</span>
                          <span>{order.items.length} ta</span>
                          <StatusPill variant={variant}>{statusLabel(order.status)}</StatusPill>
                        </div>
                        <span className="text-sm font-semibold text-bluegray-900 tabular-nums whitespace-nowrap flex-shrink-0">
                          {fmtMoney(order.total_amount)} <span className="text-[10px] font-normal text-bluegray-500 uppercase">so'm</span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </ListCard>
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <ListCard>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("common.id")}</th>
                    <th>{t("orders.orderDate")}</th>
                    <th>{t("orders.customer")}</th>
                    <th>{t("orders.itemsHeader")}</th>
                    <th className="num">{t("orders.totalAmount")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const variant = statusVariant(order.status);
                    return (
                      <tr key={order.id} onClick={() => setSheetOrder(order)} style={{ cursor: "pointer" }}>
                        <td>#{order.id}</td>
                        <td>{formatDate(order.order_date, i18n.language)}</td>
                        <td>{order.customer?.full_name ?? "—"}</td>
                        <td>{order.items.length} ta</td>
                        <td className="num">{fmtMoney(order.total_amount)}</td>
                        <td><StatusPill variant={variant}>{statusLabel(order.status)}</StatusPill></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 flex-wrap">
                            {order.status === OS.DRAFT && (
                              <>
                                <Button variant="warn" size="sm" onClick={() => startEdit(order)}>
                                  {t("orders.editOrder")}
                                </Button>
                                <Button
                                  variant="success"
                                  size="sm"
                                  disabled={actionId === order.id}
                                  onClick={() => handleAction(order.id, "complete")}
                                >
                                  {actionId === order.id && actionType === "complete" ? t("orders.completing") : t("orders.complete")}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={actionId === order.id}
                                  onClick={() => handleAction(order.id, "cancel")}
                                >
                                  {actionId === order.id && actionType === "cancel" ? t("orders.cancelling") : t("orders.cancelOrder")}
                                </Button>
                              </>
                            )}
                            {order.status === OS.COMPLETED && (
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={actionId === order.id}
                                onClick={() => handleAction(order.id, "reset")}
                              >
                                {actionId === order.id && actionType === "reset" ? t("orders.resetting") : t("orders.reset")}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ListCard>
          </div>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 mt-4 text-sm text-bluegray-500">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← {t("common.previous")}
          </Button>
          <span className="text-xs">{t("common.pageOf", { page, total: pages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")} →
          </Button>
        </div>
      )}

      {/* Mobile action sheet */}
      <BottomSheet
        open={sheetOrder !== null}
        onClose={() => setSheetOrder(null)}
        title={sheetOrder ? `#${sheetOrder.id} · ${sheetOrder.customer?.full_name ?? "—"}` : ""}
      >
        {sheetOrder && (
          <div className="px-5 pb-6 flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-bluegray-600">
              <span>{formatDate(sheetOrder.order_date, i18n.language)} · {sheetOrder.items.length} ta</span>
              <StatusPill variant={statusVariant(sheetOrder.status)}>{statusLabel(sheetOrder.status)}</StatusPill>
            </div>
            <div className="text-2xl font-semibold tabular-nums text-bluegray-900">
              {fmtMoney(sheetOrder.total_amount)} <span className="text-sm font-normal text-bluegray-500">so'm</span>
            </div>

            <div className="flex flex-col gap-1 border-t border-bluegray-100 pt-3">
              <div className="text-[11px] font-semibold text-bluegray-500 uppercase tracking-wider mb-1">
                {t("orders.itemsHeader")}
              </div>
              {sheetOrder.items.map((it) => {
                const lineTotal = (Number(it.price) || 0) * it.quantity;
                return (
                  <div key={it.id} className="py-1.5">
                    <div className="text-sm text-bluegray-800 truncate">{it.product.name}</div>
                    <div className="text-xs text-bluegray-500 tabular-nums">
                      {fmtNum(it.quantity)} × {fmtMoney(it.price)} = <span className="text-bluegray-900 font-medium">{fmtMoney(lineTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {sheetOrder.status === OS.DRAFT && (
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="warn" onClick={() => { const o = sheetOrder; setSheetOrder(null); startEdit(o); }}>
                  {t("orders.editOrder")}
                </Button>
                <Button
                  variant="success"
                  disabled={actionId === sheetOrder.id}
                  onClick={() => handleAction(sheetOrder.id, "complete")}
                >
                  {actionId === sheetOrder.id && actionType === "complete" ? t("orders.completing") : t("orders.complete")}
                </Button>
                <Button
                  variant="danger"
                  disabled={actionId === sheetOrder.id}
                  onClick={() => handleAction(sheetOrder.id, "cancel")}
                >
                  {actionId === sheetOrder.id && actionType === "cancel" ? t("orders.cancelling") : t("orders.cancelOrder")}
                </Button>
              </div>
            )}
            {sheetOrder.status === OS.COMPLETED && (
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  variant="danger"
                  disabled={actionId === sheetOrder.id}
                  onClick={() => handleAction(sheetOrder.id, "reset")}
                >
                  {actionId === sheetOrder.id && actionType === "reset" ? t("orders.resetting") : t("orders.reset")}
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => setSheetOrder(null)}>
              {t("common.close", "Yopish")}
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
