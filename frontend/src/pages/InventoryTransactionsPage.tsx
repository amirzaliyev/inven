import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../utils/date";
import { DateInput } from "../components/DateInput";
import { AsyncSelect } from "../components/AsyncSelect";
import { useToast } from "../contexts/ToastContext";
import { createInventoryTransaction, listInventoryTransactions } from "../api/inventory-transactions";
import { listProducts } from "../api/products";
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
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const [form, setForm] = useState(initialForm);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

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
      // silently fail
    } finally {
      setListLoading(false);
    }
  }, [listPage, filterType, filterSource]);

  const fetchProductOptions = useCallback(
    (q: string) => listProducts(1, 50, q || undefined).then((r) => r.items.map((p) => ({ value: p.id, label: `${p.name} (${p.sku_code})` }))),
    []
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    

    if (!form.transaction_date) {
      toast("error", t("transactions.validationDate"));
      return;
    }
    if (!form.source_id || isNaN(Number(form.source_id))) {
      toast("error", t("transactions.validationSourceId"));
      return;
    }
    if (lines.length === 0) {
      toast("error", t("transactions.validationLines"));
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.product_id || isNaN(Number(l.product_id))) {
        toast("error", t("transactions.validationLineProductId", { n: i + 1 }));
        return;
      }
      if (!l.quantity || isNaN(Number(l.quantity)) || Number(l.quantity) <= 0) {
        toast("error", t("transactions.validationLineQuantity", { n: i + 1 }));
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
      toast("success", t("transactions.createSuccess", { id: result.id }));
      setListPage(1);
      fetchTransactions();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("transactions.unexpectedError");
      toast("error", message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("transactions.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-8">&nbsp;</p>

      {/* Form card */}
      <div className="bg-white rounded-2xl shadow p-7 mb-6">
        <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-4">{t("transactions.newTransaction")}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-700" htmlFor="transaction_date">{t("transactions.transactionDate")}</label>
              <DateInput
                id="transaction_date"
                name="transaction_date"
                value={form.transaction_date}
                onChange={(v) => setForm((prev) => ({ ...prev, transaction_date: v }))}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-700" htmlFor="transaction_type">{t("transactions.transactionType")}</label>
              <select
                id="transaction_type"
                name="transaction_type"
                value={form.transaction_type}
                onChange={handleFieldChange}
                className={inputCls}
              >
                <option value={TransactionType.DEBIT}>{TransactionType.DEBIT}</option>
                <option value={TransactionType.CREDIT}>{TransactionType.CREDIT}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-700" htmlFor="source_type">{t("transactions.sourceType")}</label>
              <select
                id="source_type"
                name="source_type"
                value={form.source_type}
                onChange={handleFieldChange}
                className={inputCls}
              >
                <option value={SourceType.SALES}>{SourceType.SALES}</option>
                <option value={SourceType.DEFECT}>{SourceType.DEFECT}</option>
                <option value={SourceType.BATCH}>{SourceType.BATCH}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-bluegray-700" htmlFor="source_id">{t("transactions.sourceId")}</label>
              <input
                id="source_id"
                name="source_id"
                type="number"
                min={1}
                value={form.source_id}
                onChange={handleFieldChange}
                placeholder={t("transactions.sourceIdPlaceholder")}
                className={inputCls}
                required
              />
            </div>
          </div>

          <hr className="border-bluegray-100 my-5" />
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-3">{t("transactions.lineItems")}</p>

          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end mb-2.5">
              <div className="flex flex-col gap-1.5">
                {index === 0 && <label className="text-sm font-medium text-bluegray-700">{t("transactions.productId")}</label>}
                <AsyncSelect
                  value={line.product_id === "" ? "" : Number(line.product_id)}
                  onChange={(v) => handleLineChange(index, "product_id", v === "" ? "" : String(v))}
                  fetchOptions={fetchProductOptions}
                  placeholder={t("transactions.productId")}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {index === 0 && <label className="text-sm font-medium text-bluegray-700">{t("common.quantity")}</label>}
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => handleLineChange(index, "quantity", e.target.value)}
                  placeholder={t("transactions.qty")}
                  className={inputCls}
                />
              </div>
              <div className={index === 0 ? "pt-6" : ""}>
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={lines.length === 1}
                  title={t("transactions.remove")}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLine}
            className="mt-1 px-4 py-2 text-cyan-600 border border-dashed border-cyan-300 rounded-xl text-sm cursor-pointer hover:bg-cyan-50"
          >
            {t("transactions.addLine")}
          </button>

          <div className="flex justify-end mt-6 pt-5 border-t border-bluegray-100">
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${
                submitting ? "bg-cyan-300 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600 cursor-pointer transition-colors"
              }`}
            >
              {submitting ? t("transactions.submitting") : t("transactions.create")}
            </button>
          </div>
        </form>
      </div>

      {/* Transactions list */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("transactions.listTitle")}</p>
          <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{listTotal}</span>
        </div>

        {/* Filters */}
        <div className="flex gap-2.5 px-5 py-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as TransactionType | ""); setListPage(1); }}
            className={`flex-1 ${inputCls}`}
          >
            <option value="">{t("transactions.allTypes")}</option>
            <option value={TransactionType.DEBIT}>{TransactionType.DEBIT}</option>
            <option value={TransactionType.CREDIT}>{TransactionType.CREDIT}</option>
          </select>
          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value as SourceType | ""); setListPage(1); }}
            className={`flex-1 ${inputCls}`}
          >
            <option value="">{t("transactions.allSources")}</option>
            <option value={SourceType.SALES}>{SourceType.SALES}</option>
            <option value={SourceType.DEFECT}>{SourceType.DEFECT}</option>
            <option value={SourceType.BATCH}>{SourceType.BATCH}</option>
          </select>
        </div>

        {listLoading ? (
          <p className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</p>
        ) : txns.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-bluegray-400">{t("transactions.emptyList")}</p>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.id")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("common.date")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("transactions.typeHeader")}</th>
                  <th className="hidden sm:table-cell bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("transactions.sourceHeader")}</th>
                  <th className="bg-bluegray-50 text-xs font-semibold text-bluegray-500 uppercase tracking-wider px-5 py-3 text-left">{t("transactions.sourceId")}</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((txn) => (
                  <tr key={txn.id}>
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">#{txn.id}</td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{formatDate(txn.transaction_date, i18n.language)}</td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${
                        txn.transaction_type === TransactionType.DEBIT
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {txn.transaction_type}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{txn.source_type}</td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{txn.source_id}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            {listTotalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                    listPage <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
                  }`}
                  onClick={() => setListPage((p) => p - 1)}
                  disabled={listPage <= 1}
                >
                  <span className="sm:hidden">←</span>
                  <span className="hidden sm:inline">← {t("common.previous")}</span>
                </button>
                <span className="text-xs">{t("common.pageOf", { page: listPage, total: listTotalPages })}</span>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                    listPage >= listTotalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
                  }`}
                  onClick={() => setListPage((p) => p + 1)}
                  disabled={listPage >= listTotalPages}
                >
                  <span className="sm:hidden">→</span>
                  <span className="hidden sm:inline">{t("common.next")} →</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
