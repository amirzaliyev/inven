import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { formatDate } from "../utils/date";
import { AsyncSelect } from "../components/AsyncSelect";
import { Modal } from "../components/Modal";
import { useToast } from "../contexts/ToastContext";
import { listInventoryTransactions, reportDefect } from "../api/inventory-transactions";
import { listProducts } from "../api/products";
import { TransactionType, SourceType } from "../types";
import type { InventoryTransaction } from "../types";

interface LineItem {
  product_id: string;
  quantity: string;
}

const emptyLine = (): LineItem => ({ product_id: "", quantity: "" });

export default function InventoryTransactionsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const listPage = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("size")) || 10;
  const filterType = (searchParams.get("type") || "") as TransactionType | "";
  const filterSource = (searchParams.get("source") || "") as SourceType | "";

  const [txns, setTxns] = useState<InventoryTransaction[]>([]);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    setSearchParams(params);
  }

  // Defect modal
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectNote, setDefectNote] = useState("");
  const [defectLines, setDefectLines] = useState<LineItem[]>([emptyLine()]);
  const [defectSubmitting, setDefectSubmitting] = useState(false);
  const [defectErrors, setDefectErrors] = useState<Record<string, string>>({});

  const fetchTransactions = useCallback(async () => {
    setListLoading(true);
    try {
      const result = await listInventoryTransactions(
        listPage,
        pageSize,
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
  }, [listPage, pageSize, filterType, filterSource]);

  const fetchProductOptions = useCallback(
    (q: string) => listProducts(1, 50, q || undefined).then((r) => r.items.map((p) => ({ value: p.id, label: `${p.name} (${p.sku_code})` }))),
    []
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleDefectSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!defectNote.trim()) errs.note = t("transactions.defectNoteRequired");
    for (let i = 0; i < defectLines.length; i++) {
      const l = defectLines[i];
      if (!l.product_id) errs[`line_${i}_product`] = t("transactions.validationLineProduct", { n: i + 1 });
      if (!l.quantity || Number(l.quantity) <= 0) errs[`line_${i}_qty`] = t("transactions.validationLineQuantity", { n: i + 1 });
    }
    if (Object.keys(errs).length > 0) { setDefectErrors(errs); return; }
    setDefectErrors({});
    setDefectSubmitting(true);
    const parsed = defectLines.map(l => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));
    try {
      const result = await reportDefect({ note: defectNote.trim(), lines: parsed });
      toast("success", t("transactions.defectSuccess", { id: result.id }));
      setShowDefectModal(false);
      setDefectNote(""); setDefectLines([emptyLine()]);
      updateParams({ page: "1" });
      fetchTransactions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("transactions.unexpectedError");
      setDefectErrors({ api: msg });
    } finally {
      setDefectSubmitting(false);
    }
  }

  function closeDefectModal() {
    setShowDefectModal(false);
    setDefectNote("");
    setDefectLines([emptyLine()]);
    setDefectErrors({});
  }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-bluegray-800 mb-1 tracking-tight">{t("transactions.title")}</h1>
      <p className="text-sm text-bluegray-400 mb-6">&nbsp;</p>

      {/* Transactions list */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-bluegray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bluegray-700">{t("transactions.listTitle")}</span>
            <span className="bg-cyan-50 text-cyan-700 text-xs font-semibold px-2 py-0.5 rounded-full">{listTotal}</span>
          </div>
          <button onClick={() => setShowDefectModal(true)} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors">
            {t("transactions.reportDefect")}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2.5 px-5 py-3">
          <select
            value={filterType}
            onChange={(e) => updateParams({ type: e.target.value, page: "1" })}
            className={`flex-1 ${inputCls}`}
          >
            <option value="">{t("transactions.allTypes")}</option>
            <option value={TransactionType.DEBIT}>{t("transactions.typeDebit")}</option>
            <option value={TransactionType.CREDIT}>{t("transactions.typeCredit")}</option>
          </select>
          <select
            value={filterSource}
            onChange={(e) => updateParams({ source: e.target.value, page: "1" })}
            className={`flex-1 ${inputCls}`}
          >
            <option value="">{t("transactions.allSources")}</option>
            <option value={SourceType.SALES}>{t("transactions.sourceSales")}</option>
            <option value={SourceType.DEFECT}>{t("transactions.sourceDefect")}</option>
            <option value={SourceType.BATCH}>{t("transactions.sourceBatch")}</option>
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
                        {txn.transaction_type === TransactionType.DEBIT ? t("transactions.typeDebit") : t("transactions.typeCredit")}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">
                      {txn.source_type === SourceType.SALES ? t("transactions.sourceSales") : txn.source_type === SourceType.BATCH ? t("transactions.sourceBatch") : t("transactions.sourceDefect")}
                    </td>
                    <td className="px-5 py-3 text-sm text-bluegray-700 border-b border-bluegray-100">{txn.source_id}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-t border-bluegray-100 text-sm text-bluegray-500">
              <span className="text-xs">{t("common.pageOf", { page: listPage, total: listTotalPages })}</span>
              <div className="flex items-center gap-2">
                <label className="hidden sm:flex text-xs text-bluegray-500 items-center gap-1">
                  {t("common.perPage")}
                  <select
                    value={pageSize}
                    onChange={(e) => updateParams({ page: "1", size: e.target.value })}
                    className="ml-1 px-2 py-1 border border-bluegray-200 rounded-lg text-xs bg-white outline-none"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                    listPage <= 1 ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
                  }`}
                  onClick={() => updateParams({ page: String(listPage - 1) })}
                  disabled={listPage <= 1}
                >
                  <span className="sm:hidden">&larr;</span>
                  <span className="hidden sm:inline">&larr; {t("common.previous")}</span>
                </button>
                <button
                  className={`px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${
                    listPage >= listTotalPages ? "bg-bluegray-50 text-bluegray-300 border-bluegray-100 cursor-not-allowed" : "bg-white text-bluegray-700 border-bluegray-200 hover:bg-bluegray-50"
                  }`}
                  onClick={() => updateParams({ page: String(listPage + 1) })}
                  disabled={listPage >= listTotalPages}
                >
                  <span className="sm:hidden">&rarr;</span>
                  <span className="hidden sm:inline">{t("common.next")} &rarr;</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Defect modal */}
      <Modal open={showDefectModal} onClose={closeDefectModal} title={t("transactions.reportDefect")}>
        <form onSubmit={handleDefectSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">{t("transactions.defectNote")} <span className="text-red-400">*</span></label>
            <textarea value={defectNote} onChange={e => { setDefectNote(e.target.value); setDefectErrors(prev => { const { note, ...rest } = prev; return rest; }); }} placeholder={t("transactions.defectNotePlaceholder")} className={`${inputCls} resize-y min-h-16 font-sans ${defectErrors.note ? "!border-red-400" : ""}`} disabled={defectSubmitting} rows={2} />
            <p className="text-xs text-red-600 min-h-4">{defectErrors.note ?? "\u00A0"}</p>
          </div>
          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">{t("transactions.lineItems")}</p>
          {defectLines.map((line, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <AsyncSelect
                    value={line.product_id === "" ? "" : Number(line.product_id)}
                    onChange={v => { setDefectLines(prev => prev.map((l, j) => j === i ? { ...l, product_id: v === "" ? "" : String(v) } : l)); setDefectErrors(prev => { const n = { ...prev }; delete n[`line_${i}_product`]; return n; }); }}
                    fetchOptions={fetchProductOptions}
                    placeholder={t("common.selectProduct")}
                    className={`${inputCls} ${defectErrors[`line_${i}_product`] ? "!border-red-400" : ""}`}
                  />
                </div>
                <div className="w-24 flex-shrink-0">
                  <input type="number" min={1} value={line.quantity} onChange={e => { setDefectLines(prev => prev.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l)); setDefectErrors(prev => { const n = { ...prev }; delete n[`line_${i}_qty`]; return n; }); }} placeholder={t("transactions.qty")} className={`${inputCls} w-full ${defectErrors[`line_${i}_qty`] ? "!border-red-400" : ""}`} />
                </div>
                <button type="button" onClick={() => setDefectLines(prev => prev.filter((_, j) => j !== i))} disabled={defectLines.length === 1}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-40 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-red-600 min-h-4">{defectErrors[`line_${i}_product`] || defectErrors[`line_${i}_qty`] || "\u00A0"}</p>
            </div>
          ))}
          <button type="button" onClick={() => setDefectLines(prev => [...prev, emptyLine()])} className="px-4 py-2 text-cyan-600 border border-dashed border-cyan-300 rounded-xl text-sm cursor-pointer hover:bg-cyan-50">
            {t("transactions.addLine")}
          </button>
          {defectErrors.api && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{defectErrors.api}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeDefectModal} className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer">{t("common.cancel")}</button>
            <button type="submit" disabled={defectSubmitting} className={`px-5 py-2 rounded-xl text-sm font-semibold text-white ${defectSubmitting ? "bg-red-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 cursor-pointer transition-colors"}`}>
              {defectSubmitting ? t("transactions.submitting") : t("transactions.reportDefect")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
