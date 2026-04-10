import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../utils/date";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { DateInput } from "../components/DateInput";
import { Modal } from "../components/Modal";
import { AsyncSelect } from "../components/AsyncSelect";
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

function statusBadge(status: OrderStatus, t: (k: string) => string) {
  const map: Record<string, { cls: string; label: string }> = {
    DRAFT:     { cls: "bg-blue-100 text-blue-700", label: t("orders.statusDraft") },
    COMPLETED: { cls: "bg-green-100 text-green-700", label: t("orders.statusCompleted") },
    CANCELLED: { cls: "bg-red-100 text-red-600", label: t("orders.statusCancelled") },
  };
  const s = map[status] ?? map.DRAFT;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();

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

  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<string>("");

  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        product_id: it.product_id,
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

  function addItem(f: FormState, setF: (v: FormState) => void) {
    setF({ ...f, items: [...f.items, emptyItem()] });
  }

  function removeItem(f: FormState, setF: (v: FormState) => void, idx: number) {
    setF({ ...f, items: f.items.filter((_, i) => i !== idx) });
  }

  function calcTotal(items: FormItem[]) {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
  }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  function renderItemsForm(f: FormState, setF: (v: FormState) => void, errors: Record<string, string>, setErrors: (v: Record<string, string>) => void) {
    return (
      <div className="mt-3">
        {/* Column labels */}
        <div className="hidden sm:grid grid-cols-[1fr_6rem_6rem_1.75rem] gap-2 mb-1 px-0.5">
          <span className="text-xs font-semibold text-bluegray-400 uppercase tracking-wider">{t("common.product")}</span>
          <span className="text-xs font-semibold text-bluegray-400 uppercase tracking-wider">{t("common.quantity")}</span>
          <span className="text-xs font-semibold text-bluegray-400 uppercase tracking-wider">{t("orders.price")}</span>
          <span />
        </div>

        {/* Item rows */}
        <div className="space-y-2">
          {f.items.map((it, idx) => (
            <div key={idx}>
              <div className="flex flex-wrap sm:grid sm:grid-cols-[1fr_6rem_6rem_1.75rem] gap-2 items-center">
                <div className="w-full sm:w-auto">
                  <AsyncSelect
                    value={it.product_id}
                    onChange={(v) => updateFormItem(f, setF, idx, "product_id", v === "" ? "" : String(v), errors, setErrors)}
                    fetchOptions={fetchProductOptions}
                    placeholder={t("common.selectProduct")}
                    className={`${inputCls}${errors[`item_${idx}_product`] ? " !border-red-400" : ""}`}
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => updateFormItem(f, setF, idx, "quantity", e.target.value, errors, setErrors)}
                  placeholder={t("common.quantity")}
                  className={`${inputCls} flex-1 sm:flex-none sm:w-full min-w-0${errors[`item_${idx}_qty`] ? " !border-red-400" : ""}`}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.price}
                  onChange={(e) => updateFormItem(f, setF, idx, "price", e.target.value, errors, setErrors)}
                  placeholder={t("orders.price")}
                  className={`${inputCls} flex-1 sm:flex-none sm:w-full min-w-0${errors[`item_${idx}_price`] ? " !border-red-400" : ""}`}
                />
                {f.items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItem(f, setF, idx)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : <span />}
              </div>
              <p className="text-xs text-red-500 min-h-4">{errors[`item_${idx}_product`] || errors[`item_${idx}_qty`] || errors[`item_${idx}_price`] || "\u00A0"}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-3 pt-3 border-t border-bluegray-100">
          <button
            type="button"
            className="px-3 py-1.5 text-cyan-600 border border-cyan-200 rounded-xl text-sm font-medium hover:bg-cyan-50 cursor-pointer transition-colors"
            onClick={() => addItem(f, setF)}
          >
            + {t("orders.addItem")}
          </button>
          <span className="text-sm font-semibold text-bluegray-700">
            {t("orders.totalAmount")}: {calcTotal(f.items).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  const totalPages = pages;

  return (
    <div className="max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("orders.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-8">{t("orders.subtitle")}</p>

      {/* Create modal */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateErrors({}); setForm({ order_date: todayStr(), customer_id: "", items: [emptyItem()] }); }}
        title={t("orders.newOrder")}
        size="lg"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-bluegray-600">{t("orders.orderDate")} <span className="text-red-400">*</span></label>
              <DateInput
                value={form.order_date}
                onChange={(v) => { setForm({ ...form, order_date: v }); if (createErrors.order_date) { const next = { ...createErrors }; delete next.order_date; setCreateErrors(next); } }}
                className={`${inputCls}${createErrors.order_date ? " !border-red-400" : ""}`}
              />
              {createErrors.order_date && <span className="text-xs text-red-500">{createErrors.order_date}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-bluegray-600">{t("orders.customer")} <span className="text-red-400">*</span></label>
              <AsyncSelect
                value={form.customer_id}
                onChange={(v) => { setForm({ ...form, customer_id: v }); if (createErrors.customer_id) { const next = { ...createErrors }; delete next.customer_id; setCreateErrors(next); } }}
                fetchOptions={fetchCustomerOptions}
                placeholder={t("orders.selectCustomer")}
                className={`${inputCls}${createErrors.customer_id ? " !border-red-400" : ""}`}
              />
              {createErrors.customer_id && <span className="text-xs text-red-500">{createErrors.customer_id}</span>}
            </div>
          </div>
          {renderItemsForm(form, setForm, createErrors, setCreateErrors)}
          {createErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t border-bluegray-100">
            <button
              className="px-4 py-2 bg-white text-bluegray-600 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
              onClick={() => { setShowCreateModal(false); setCreateErrors({}); setForm({ order_date: todayStr(), customer_id: "", items: [emptyItem()] }); }}
            >
              {t("orders.cancelEdit")}
            </button>
            <button
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${creating ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? t("orders.creating") : t("orders.create")}
            </button>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-bluegray-600">{t("orders.orderDate")} <span className="text-red-400">*</span></label>
              <DateInput
                value={editForm.order_date}
                onChange={(v) => { setEditForm({ ...editForm, order_date: v }); if (editErrors.order_date) { const next = { ...editErrors }; delete next.order_date; setEditErrors(next); } }}
                className={`${inputCls}${editErrors.order_date ? " !border-red-400" : ""}`}
              />
              {editErrors.order_date && <span className="text-xs text-red-500">{editErrors.order_date}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-bluegray-600">{t("orders.customer")} <span className="text-red-400">*</span></label>
              <AsyncSelect
                value={editForm.customer_id}
                onChange={(v) => { setEditForm({ ...editForm, customer_id: v }); setEditCustomerName(""); if (editErrors.customer_id) { const next = { ...editErrors }; delete next.customer_id; setEditErrors(next); } }}
                fetchOptions={fetchCustomerOptions}
                placeholder={t("orders.selectCustomer")}
                displayValue={editCustomerName || undefined}
                className={`${inputCls}${editErrors.customer_id ? " !border-red-400" : ""}`}
              />
              {editErrors.customer_id && <span className="text-xs text-red-500">{editErrors.customer_id}</span>}
            </div>
          </div>
          {renderItemsForm(editForm, setEditForm, editErrors, setEditErrors)}
          {editErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t border-bluegray-100">
            <button
              className="px-4 py-2 bg-white text-bluegray-600 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
              onClick={() => { setEditId(null); setEditErrors({}); }}
            >
              {t("orders.cancelEdit")}
            </button>
            <button
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${saving ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"}`}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? t("orders.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Orders list */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("orders.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{total}</span>
          </div>
          <button
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            + {t("orders.newOrder")}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-5 py-3 flex-wrap items-center">
          <AsyncSelect
            value={filterCustomer}
            onChange={(v) => { setFilterCustomer(v); setPage(1); }}
            fetchOptions={fetchCustomerOptions}
            placeholder={t("orders.filterCustomer")}
            clearable={true}
            className={`w-44 px-3 py-2 border border-bluegray-200 rounded-xl`}
          />
          <DateInput
            value={filterDateFrom}
            onChange={(v) => { setFilterDateFrom(v); setPage(1); }}
            className={`w-36 ${inputCls}`}
          />
          <DateInput
            value={filterDateTo}
            onChange={(v) => { setFilterDateTo(v); setPage(1); }}
            className={`w-36 ${inputCls}`}
          />
          {(filterCustomer !== "" || filterDateFrom || filterDateTo) && (
            <button
              className="px-4 py-2 bg-white text-bluegray-600 border border-bluegray-200 rounded-xl text-sm font-medium hover:bg-bluegray-50 cursor-pointer"
              onClick={() => { setFilterCustomer(""); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }}
            >
              {t("common.clear")}
            </button>
          )}
        </div>

        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
              <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("orders.orderDate")}</th>
              <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("orders.customer")}</th>
              <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("orders.totalAmount")}</th>
              <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.status")}</th>
              <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("orders.itemsHeader")}</th>
              <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-bluegray-400">{t("orders.emptyList")}</td></tr>
            ) : orders.map((order) => (
              <>
                <tr key={order.id}>
                  <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">#{order.id}</td>
                  <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{formatDate(order.order_date, i18n.language)}</td>
                  <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{order.customer?.full_name ?? `#${order.customer_id}`}</td>
                  <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{Number(order.total_amount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{statusBadge(order.status, t)}</td>
                  <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                    <button
                      className="px-2 py-1 text-bluegray-500 border border-bluegray-200 rounded-lg text-xs font-medium hover:bg-bluegray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    >
                      {order.items.length} {expandedId === order.id ? "▲" : "▼"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                    <div className="flex gap-1.5 flex-wrap">
                      {order.status === OS.DRAFT && (
                        <>
                          <button
                            className="px-2 py-1 text-cyan-600 border border-cyan-200 rounded-lg text-xs font-medium hover:bg-cyan-50 cursor-pointer"
                            onClick={() => startEdit(order)}
                          >
                            <span className="sm:hidden">✎</span>
                            <span className="hidden sm:inline">{t("orders.editOrder")}</span>
                          </button>
                          <button
                            className="px-2 py-1 text-green-600 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-50 cursor-pointer disabled:opacity-60"
                            disabled={actionId === order.id}
                            onClick={() => handleAction(order.id, "complete")}
                          >
                            <span className="sm:hidden">✓</span>
                            <span className="hidden sm:inline">{actionId === order.id && actionType === "complete" ? t("orders.completing") : t("orders.complete")}</span>
                          </button>
                          <button
                            className="px-2 py-1 text-red-500 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50 cursor-pointer disabled:opacity-60"
                            disabled={actionId === order.id}
                            onClick={() => handleAction(order.id, "cancel")}
                          >
                            <span className="sm:hidden">✕</span>
                            <span className="hidden sm:inline">{actionId === order.id && actionType === "cancel" ? t("orders.cancelling") : t("orders.cancelOrder")}</span>
                          </button>
                        </>
                      )}
                      {(order.status === OS.COMPLETED || order.status === OS.CANCELLED) && (
                        <button
                          className="px-2 py-1 text-purple-600 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-50 cursor-pointer disabled:opacity-60"
                          disabled={actionId === order.id}
                          onClick={() => handleAction(order.id, "reset")}
                        >
                          <span className="sm:hidden">↺</span>
                          <span className="hidden sm:inline">{actionId === order.id && actionType === "reset" ? t("orders.resetting") : t("orders.reset")}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === order.id && (
                  <tr key={`${order.id}-items`}>
                    <td colSpan={7} className="px-8 pb-4 bg-bluegray-50">
                      <table className="w-full border-collapse mt-1">
                        <thead>
                          <tr>
                            <th className="bg-bluegray-100 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-2 text-left">{t("common.product")}</th>
                            <th className="bg-bluegray-100 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-2 text-left">{t("common.quantity")}</th>
                            <th className="bg-bluegray-100 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-2 text-left">{t("orders.price")}</th>
                            <th className="bg-bluegray-100 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-4 py-2 text-left">{t("orders.totalAmount")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((it) => (
                            <tr key={it.id}>
                              <td className="px-4 py-2 text-sm text-bluegray-700 border-b border-bluegray-100">#{it.product_id}</td>
                              <td className="px-4 py-2 text-sm text-bluegray-700 border-b border-bluegray-100">{it.quantity}</td>
                              <td className="px-4 py-2 text-sm text-bluegray-700 border-b border-bluegray-100">{Number(it.price).toLocaleString()}</td>
                              <td className="px-4 py-2 text-sm text-bluegray-700 border-b border-bluegray-100">{(it.quantity * Number(it.price)).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table></div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
          <button
            className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← {t("common.previous")}</span>
          </button>
          <span className="text-xs">{t("common.pageOf", { page, total: totalPages })}</span>
          <button
            className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${page >= totalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"}`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <span className="sm:hidden">→</span>
            <span className="hidden sm:inline">{t("common.next")} →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
