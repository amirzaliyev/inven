import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  PageHead,
  Button,
  SegmentedControl,
  ListCard,
  ListRow,
  EmptyState,
  fmtNum,
} from "../components/ui";

interface LineItem {
  product_id: string;
  quantity: string;
}

const emptyLine = (): LineItem => ({ product_id: "", quantity: "" });

type FilterValue = "ALL" | "DEBIT" | "CREDIT";

interface TxnLineLike {
  product_id?: number | string;
  product_name?: string;
  quantity?: number | string;
}

type TxnRich = InventoryTransaction & {
  total_quantity?: number | string;
};

function ArrowIcon({ direction }: { direction: "in" | "out" }) {
  // DEBIT (in) = arrow down into box; CREDIT (out) = arrow up
  const rot = direction === "in" ? 0 : 180;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M12 4v12" />
      <path d="M6 12l6 6 6-6" />
    </svg>
  );
}

export default function InventoryTransactionsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const listPage = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("size")) || 10;
  const rawType = (searchParams.get("type") || "") as TransactionType | "";
  const typeFilter: FilterValue =
    rawType === TransactionType.CREDIT ? "DEBIT" : rawType === TransactionType.DEBIT ? "CREDIT" : "ALL";

  const [txns, setTxns] = useState<InventoryTransaction[]>([]);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState<InventoryTransaction | null>(null);

  const canWrite = true;

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    setSearchParams(params);
  }

  const setTypeFilter = (v: FilterValue) => {
    const apiVal = v === "DEBIT" ? TransactionType.CREDIT : v === "CREDIT" ? TransactionType.DEBIT : "";
    updateParams({ type: String(apiVal), page: "1" });
  };

  // Defect (create) modal
  const [showCreate, setShowCreate] = useState(false);
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
        rawType || undefined,
        undefined
      );
      setTxns(result.items);
      setListTotalPages(result.pages);
      setListTotal(result.total);
    } catch {
      // silently fail
    } finally {
      setListLoading(false);
    }
  }, [listPage, pageSize, rawType]);

  const fetchProductOptions = useCallback(
    (q: string) =>
      listProducts(1, 50, q || undefined).then((r) =>
        r.items.map((p) => ({ value: p.id, label: `${p.name} (${p.sku_code})` }))
      ),
    []
  );

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function openCreate() {
    setDefectNote("");
    setDefectLines([emptyLine()]);
    setDefectErrors({});
    setShowCreate(true);
  }

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
    const parsed = defectLines.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));
    try {
      const result = await reportDefect({ note: defectNote.trim(), lines: parsed });
      toast("success", t("transactions.defectSuccess", { id: result.id }));
      setShowCreate(false);
      setDefectNote("");
      setDefectLines([emptyLine()]);
      updateParams({ page: "1" });
      fetchTransactions();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("transactions.unexpectedError");
      setDefectErrors({ api: msg });
    } finally {
      setDefectSubmitting(false);
    }
  }

  function closeCreate() {
    setShowCreate(false);
    setDefectNote("");
    setDefectLines([emptyLine()]);
    setDefectErrors({});
  }

  const inputCls = "px-3 py-2 border border-bluegray-200 rounded-xl text-sm outline-none focus:border-cyan-400 focus:shadow-sm bg-white";

  function sourceLabel(s: SourceType) {
    return s === SourceType.SALES
      ? t("transactions.sourceSales", "SALES")
      : s === SourceType.BATCH
      ? t("transactions.sourceBatch", "BATCH")
      : t("transactions.sourceDefect", "DEFECT");
  }

  function txnLines(txn: InventoryTransaction): TxnLineLike[] {
    return (txn.lines ?? []) as TxnLineLike[];
  }
  function txnLineCount(txn: InventoryTransaction): number {
    return txnLines(txn).length;
  }
  function txnTotalQty(txn: InventoryTransaction): number {
    const r = txn as TxnRich;
    if (r.total_quantity != null) return Number(r.total_quantity) || 0;
    return txnLines(txn).reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);
  }

  const segmentOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("transactions.all", "Hammasi") },
      { value: "DEBIT" as const, label: t("transactions.in", "Kirim") },
      { value: "CREDIT" as const, label: t("transactions.out", "Chiqim") },
    ],
    [t]
  );

  const debitTint = { background: "#d1fae5", color: "#065f46" };
  const creditTint = { background: "#fee2e2", color: "#991b1b" };

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <PageHead
        title={t("transactions.title", "Ombor operatsiyalari")}
        subtitle={t("transactions.subtitle", `${listTotal} ${t("transactions.records", "ta yozuv")}`)}
        actions={
          canWrite && (
            <Button onClick={openCreate}>{t("transactions.addNew", "Yangi qo'shish")}</Button>
          )
        }
      />

      <div className="mb-4">
        <SegmentedControl<FilterValue>
          value={typeFilter}
          onChange={setTypeFilter}
          options={segmentOptions}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
      {listLoading ? (
        <ListCard>
          <p className="px-5 py-10 text-center text-sm text-bluegray-400">{t("common.loading")}</p>
        </ListCard>
      ) : txns.length === 0 ? (
        <EmptyState
          title={t("transactions.emptyList", "Operatsiyalar yo'q")}
          description={t("transactions.emptyDesc", "Hali hech qanday ombor operatsiyasi qayd etilmagan.")}
        />
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden">
            <ListCard>
              {txns.map((txn) => {
                const isIn = txn.transaction_type === TransactionType.CREDIT;
                const lc = txnLineCount(txn);
                const qty = txnTotalQty(txn);
                return (
                  <ListRow
                    key={txn.id}
                    avatar={
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          ...(isIn ? debitTint : creditTint),
                        }}
                      >
                        <ArrowIcon direction={isIn ? "in" : "out"} />
                      </div>
                    }
                    title={
                      <span>
                        {sourceLabel(txn.source_type)}{" "}
                        <span className="text-bluegray-400 font-normal">#{txn.source_id}</span>
                      </span>
                    }
                    subtitle={
                      <span>
                        {formatDate(txn.transaction_date, i18n.language)}
                        {lc > 0 && (
                          <>
                            {" · "}
                            {t("transactions.nProducts", { count: lc, defaultValue: `${lc} ta mahsulot` })}
                          </>
                        )}
                      </span>
                    }
                    metric={qty > 0 ? { value: fmtNum(qty), unit: t("common.unitDona", "dona") } : undefined}
                    onClick={() => setDetail(txn)}
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
                    <th>{t("common.date")}</th>
                    <th>{t("transactions.typeHeader", "Turi")}</th>
                    <th>{t("transactions.sourceHeader", "Manba")}</th>
                    <th>{t("nav.products")}</th>
                    <th className="num">{t("transactions.totalQty", "Jami")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((txn) => {
                    const isIn = txn.transaction_type === TransactionType.CREDIT;
                    const lc = txnLineCount(txn);
                    const qty = txnTotalQty(txn);
                    return (
                      <tr key={txn.id}>
                        <td>{formatDate(txn.transaction_date, i18n.language)}</td>
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "2px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              ...(isIn ? debitTint : creditTint),
                            }}
                          >
                            <ArrowIcon direction={isIn ? "in" : "out"} />
                            {isIn ? t("transactions.in", "Kirim") : t("transactions.out", "Chiqim")}
                          </span>
                        </td>
                        <td>
                          {sourceLabel(txn.source_type)}{" "}
                          <span className="text-bluegray-400">#{txn.source_id}</span>
                        </td>
                        <td>
                          {lc > 0
                            ? t("transactions.nProducts", { count: lc, defaultValue: `${lc} ta mahsulot` })
                            : "—"}
                        </td>
                        <td className="num">{qty > 0 ? fmtNum(qty) : "—"}</td>
                        <td className="num">
                          <Button variant="outline" size="sm" onClick={() => setDetail(txn)}>
                            {t("common.view", "Ko'rish")}
                          </Button>
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
      </div>

      {!listLoading && txns.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap mt-4 text-sm text-bluegray-500 flex-shrink-0">
          <span className="text-xs">
            {t("common.pageOf", { page: listPage, total: Math.max(1, listTotalPages) })} · {listTotal}
          </span>
          <div className="flex items-center gap-2">
            <label className="hidden md:flex text-xs text-bluegray-500 items-center gap-1">
              {t("common.perPage")}
              <select
                value={pageSize}
                onChange={(e) => updateParams({ page: "1", size: e.target.value })}
                className="ml-1 px-2 py-1 border border-bluegray-200 rounded-lg text-xs bg-white outline-none"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: String(listPage - 1) })}
              disabled={listPage <= 1 || listLoading}
            >
              <span className="md:hidden">&larr;</span>
              <span className="hidden md:inline">&larr; {t("common.previous")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: String(listPage + 1) })}
              disabled={listPage >= listTotalPages || listLoading}
            >
              <span className="md:hidden">&rarr;</span>
              <span className="hidden md:inline">{t("common.next")} &rarr;</span>
            </Button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal
          open={!!detail}
          onClose={() => setDetail(null)}
          title={`${sourceLabel(detail.source_type)} #${detail.source_id}`}
        >
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-bluegray-500">{t("common.date")}</span>
              <span className="text-bluegray-800 font-medium">
                {formatDate(detail.transaction_date, i18n.language)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-bluegray-500">{t("transactions.typeHeader", "Turi")}</span>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  ...(detail.transaction_type === TransactionType.CREDIT ? debitTint : creditTint),
                }}
              >
                {detail.transaction_type === TransactionType.CREDIT
                  ? t("transactions.in", "Kirim")
                  : t("transactions.out", "Chiqim")}
              </span>
            </div>
            {txnLineCount(detail) > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider mb-2">
                  {t("transactions.lineItems")}
                </p>
                <div className="flex flex-col gap-2">
                  {txnLines(detail).map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-bluegray-50 rounded-xl px-3 py-2"
                    >
                      <span className="text-bluegray-700">
                        {l.product_name ?? `#${l.product_id ?? ""}`}
                      </span>
                      <span className="font-semibold text-bluegray-800">
                        {fmtNum(Number(l.quantity) || 0)} {t("common.unitDona", "dona")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create / defect modal */}
      <Modal open={showCreate} onClose={closeCreate} title={t("transactions.reportDefect")}>
        <form onSubmit={handleDefectSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-bluegray-600">
              {t("transactions.defectNote")} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={defectNote}
              onChange={(e) => {
                setDefectNote(e.target.value);
                setDefectErrors((prev) => {
                  const { note: _omit, ...rest } = prev;
                  void _omit;
                  return rest;
                });
              }}
              placeholder={t("transactions.defectNotePlaceholder")}
              className={`${inputCls} resize-y min-h-16 font-sans ${defectErrors.note ? "!border-red-400" : ""}`}
              disabled={defectSubmitting}
              rows={2}
            />
            <p className="text-xs text-red-600 min-h-4">{defectErrors.note ?? " "}</p>
          </div>

          <p className="text-xs font-semibold text-bluegray-500 uppercase tracking-wider">
            {t("transactions.lineItems")}
          </p>

          <div className="flex flex-col gap-2">
            {defectLines.map((line, i) => (
              <div
                key={i}
                className="bg-bluegray-50 border border-bluegray-100 rounded-2xl p-3 flex flex-col gap-2"
              >
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <AsyncSelect
                      value={line.product_id === "" ? "" : Number(line.product_id)}
                      onChange={(v) => {
                        setDefectLines((prev) =>
                          prev.map((l, j) =>
                            j === i ? { ...l, product_id: v === "" ? "" : String(v) } : l
                          )
                        );
                        setDefectErrors((prev) => {
                          const n = { ...prev };
                          delete n[`line_${i}_product`];
                          return n;
                        });
                      }}
                      fetchOptions={fetchProductOptions}
                      placeholder={t("common.selectProduct")}
                      className={`${inputCls} ${defectErrors[`line_${i}_product`] ? "!border-red-400" : ""}`}
                    />
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => {
                        setDefectLines((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l))
                        );
                        setDefectErrors((prev) => {
                          const n = { ...prev };
                          delete n[`line_${i}_qty`];
                          return n;
                        });
                      }}
                      placeholder={t("transactions.qty")}
                      className={`${inputCls} w-full ${defectErrors[`line_${i}_qty`] ? "!border-red-400" : ""}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDefectLines((prev) => prev.filter((_, j) => j !== i))}
                    disabled={defectLines.length === 1}
                    className="icon-btn icon-btn-danger flex-shrink-0"
                    aria-label="Remove line"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {(defectErrors[`line_${i}_product`] || defectErrors[`line_${i}_qty`]) && (
                  <p className="text-xs text-red-600">
                    {defectErrors[`line_${i}_product`] || defectErrors[`line_${i}_qty`]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDefectLines((prev) => [...prev, emptyLine()])}
          >
            {t("transactions.addLine")}
          </Button>

          {defectErrors.api && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {defectErrors.api}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeCreate}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" disabled={defectSubmitting}>
              {defectSubmitting ? t("transactions.submitting") : t("transactions.reportDefect")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
