import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useBudgetSection } from "@/hooks/useBudgetSections";
import { useSectionInvoices } from "@/hooks/useSectionInvoices";
import { useSectionQuotes } from "@/hooks/useSectionQuotes";
import { useSectionPayments } from "@/hooks/useSectionPayments";
import {
  computeSectionOpenTotal,
  computeSectionPaidTotal,
  computeSectionVariance,
} from "@/lib/budget/totals";
import {
  daysOverdue,
  getInvoiceStatus,
  type ComputedInvoiceStatus,
} from "@/lib/budget/invoiceStatus";
import { formatCzk } from "@/lib/budget/format";
import { deleteSection } from "@/lib/budget/sections";
import {
  deleteAllInvoicesForSection,
  deleteInvoice as deleteInvoiceFn,
} from "@/lib/budget/invoices";
import { deleteQuote } from "@/lib/budget/quotes";
import { deletePayment } from "@/lib/budget/payments";
import { getInvoicePdfUrl } from "@/lib/budget/storage";
import SectionModal from "@/components/budget/SectionModal";
import ExpectedAmountModal from "@/components/budget/ExpectedAmountModal";
import VarianceChip from "@/components/budget/VarianceChip";
import InvoiceModal from "@/components/budget/InvoiceModal";
import QuoteModal from "@/components/budget/QuoteModal";
import PaymentModal from "@/components/budget/PaymentModal";
import StatusChip from "@/components/budget/StatusChip";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { rozpocetSekce } from "@/lib/routes";
import type { BudgetInvoice, BudgetPayment, BudgetQuote } from "@/types";
import { ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";

type FilterKey = "all" | "OPEN" | "OVERDUE" | "PAID";

export default function RozpocetSekceDetail() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const sectionState = useBudgetSection(id);
  const invoicesState = useSectionInvoices(id);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [filter, setFilter] = useState<FilterKey>("all");

  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [expectedModalOpen, setExpectedModalOpen] = useState(false);
  const [deleteSectionOpen, setDeleteSectionOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; invoice: BudgetInvoice }
    | null
  >(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] =
    useState<BudgetInvoice | null>(null);

  const quotesState = useSectionQuotes(id);
  const paymentsState = useSectionPayments(id);
  const [quoteModal, setQuoteModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; quote: BudgetQuote }
    | null
  >(null);
  const [paymentModal, setPaymentModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; payment: BudgetPayment }
    | null
  >(null);
  const [deleteQuoteTarget, setDeleteQuoteTarget] =
    useState<BudgetQuote | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] =
    useState<BudgetPayment | null>(null);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  const totals = useMemo(() => {
    const invs = invoicesState.status === "ready" ? invoicesState.invoices : [];
    const pays = paymentsState.status === "ready" ? paymentsState.payments : [];
    return {
      paid: computeSectionPaidTotal(invs, pays),
      open: computeSectionOpenTotal(invs),
    };
  }, [invoicesState, paymentsState]);

  const variance = useMemo(() => {
    const sectionPart =
      sectionState.status === "ready"
        ? sectionState.section
        : { expectedAmountCzk: null };
    const invoices =
      invoicesState.status === "ready" ? invoicesState.invoices : [];
    const pays = paymentsState.status === "ready" ? paymentsState.payments : [];
    return computeSectionVariance(sectionPart, invoices, pays);
  }, [sectionState, invoicesState, paymentsState]);

  const filteredInvoices = useMemo(() => {
    if (invoicesState.status !== "ready") return [];
    if (filter === "all") return invoicesState.invoices;
    return invoicesState.invoices.filter(
      (inv) => getInvoiceStatus(inv, today) === filter,
    );
  }, [invoicesState, filter, today]);

  if (!id) return <Navigate to={rozpocetSekce()} replace />;

  if (sectionState.status === "loading") {
    return (
      <section className="mx-auto max-w-xl px-4 py-6">
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.sekce.loading")}
        </p>
      </section>
    );
  }

  if (sectionState.status === "missing") {
    return (
      <section className="mx-auto max-w-xl px-4 py-8 text-center space-y-4">
        <p className="text-base font-semibold text-ink">
          {t("budget.sekce.missingTitle")}
        </p>
        <button
          type="button"
          onClick={() => navigate(rozpocetSekce())}
          className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          {t("budget.sekce.backToList")}
        </button>
      </section>
    );
  }

  if (sectionState.status === "error") {
    return (
      <section className="mx-auto max-w-xl px-4 py-6">
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.sekce.errorLoad")}
        </p>
      </section>
    );
  }

  const section = sectionState.section;

  async function handleDeleteSection() {
    if (!id) return;
    setBusyDelete(true);
    try {
      await deleteAllInvoicesForSection(id);
      await deleteSection(id);
      navigate(rozpocetSekce());
    } catch (err) {
      console.error("delete section failed", err);
      alert(t("budget.sekce.errorDelete"));
    } finally {
      setBusyDelete(false);
      setDeleteSectionOpen(false);
    }
  }

  async function handleDeleteInvoice(inv: BudgetInvoice) {
    if (!id) return;
    try {
      await deleteInvoiceFn(id, inv.id, { pdfPath: inv.pdfPath ?? null });
    } catch (err) {
      console.error("delete invoice failed", err);
      alert(t("budget.invoice.errorDelete"));
    } finally {
      setDeleteInvoiceTarget(null);
    }
  }

  async function handleOpenPdf(pdfPath: string) {
    try {
      const url = await getInvoicePdfUrl(pdfPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("open pdf failed", err);
      alert(t("budget.invoice.pdfErrorOpen"));
    }
  }

  const totalCount = invoicesState.status === "ready" ? invoicesState.invoices.length : 0;

  return (
    <section
      aria-labelledby="rozpocet-sekce-detail-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <button
        type="button"
        onClick={() => navigate(rozpocetSekce())}
        className="inline-flex items-center gap-1 -ml-2 px-2 py-1 text-sm text-ink-link hover:text-ink-link-hover"
        aria-label={t("budget.sekce.backToList")}
      >
        <ArrowLeft aria-hidden size={16} />
        {t("budget.sekce.title")}
      </button>

      <header className="flex items-start justify-between gap-3">
        <h2
          id="rozpocet-sekce-detail-heading"
          className="text-xl font-semibold tracking-tight text-ink min-w-0 flex-1 break-words"
        >
          {section.title}
        </h2>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditSectionOpen(true)}
            aria-label={t("budget.sekce.editAria")}
            title={t("common.edit")}
            className="grid size-10 place-items-center rounded-md border border-line text-ink hover:bg-bg-subtle"
          >
            <Pencil aria-hidden size={16} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteSectionOpen(true)}
            aria-label={t("budget.sekce.deleteAria")}
            title={t("common.delete")}
            className="grid size-10 place-items-center rounded-md border border-line text-ink hover:bg-bg-subtle"
          >
            <Trash2 aria-hidden size={16} />
          </button>
        </div>
      </header>

      {section.description ? (
        <p className="text-sm text-ink-muted leading-relaxed">{section.description}</p>
      ) : null}

      {/* Plán + variance */}
      <div className="rounded-md border border-line bg-surface-raised p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              {t("budget.sekce.planLabel")}
            </span>
            <span className="text-lg font-semibold text-ink tabular-nums">
              {variance.plannedCzk !== null ? formatCzk(variance.plannedCzk) : "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpectedModalOpen(true)}
            className="min-h-tap rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg-subtle"
          >
            {variance.plannedCzk !== null
              ? t("budget.sekce.editPlanCta")
              : t("budget.sekce.setPlanCta")}
          </button>
        </div>
        {variance.plannedCzk !== null ? (
          <VarianceChip
            state={variance.state}
            variance={variance.variance}
            variancePercent={variance.variancePercent}
            size="md"
          />
        ) : null}
      </div>

      {/* Sumy */}
      <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface-raised p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            {t("budget.sekce.paidLabel")}
          </span>
          <span className="text-lg font-semibold text-ink tabular-nums">
            {formatCzk(totals.paid)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            {t("budget.sekce.openLabel")}
          </span>
          <span className="text-lg font-semibold text-status-warning-fg tabular-nums">
            {formatCzk(totals.open)}
          </span>
        </div>
      </div>

      {/* Faktury */}
      <header className="flex items-center justify-between gap-3 mt-2">
        <h3 className="text-base font-semibold text-ink">
          {t("budget.invoice.listTitle")}
        </h3>
        <button
          type="button"
          onClick={() => setInvoiceModal({ mode: "create" })}
          className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          <Plus aria-hidden size={16} />
          {t("budget.invoice.addCta")}
        </button>
      </header>

      {totalCount > 0 ? (
        <div role="tablist" aria-label="Filter faktur" className="flex flex-wrap gap-2">
          {(["all", "OPEN", "OVERDUE", "PAID"] as FilterKey[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={[
                "rounded-pill border px-3 py-1 text-xs font-medium transition-colors",
                filter === k
                  ? "border-accent bg-accent text-accent-on"
                  : "border-line bg-surface text-ink-muted hover:bg-bg-subtle",
              ].join(" ")}
            >
              {t(`budget.sekce.filter${k === "all" ? "All" : k === "OPEN" ? "Open" : k === "OVERDUE" ? "Overdue" : "Paid"}`)}
            </button>
          ))}
        </div>
      ) : null}

      {invoicesState.status === "loading" ? (
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.invoice.loading")}
        </p>
      ) : invoicesState.status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.invoice.errorLoad")}
        </p>
      ) : invoicesState.invoices.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface px-4 py-6 text-center space-y-3">
          <p className="text-sm text-ink-muted leading-relaxed">
            {t("budget.invoice.emptyDesc")}
          </p>
          <button
            type="button"
            onClick={() => setInvoiceModal({ mode: "create" })}
            className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
          >
            <Plus aria-hidden size={16} />
            {t("budget.invoice.firstCta")}
          </button>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-3 py-4 text-center text-sm text-ink-muted">
          {t("budget.sekce.filterEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredInvoices.map((inv) => {
            const computedStatus: ComputedInvoiceStatus = getInvoiceStatus(inv, today);
            const overdueDays =
              computedStatus === "OVERDUE" && inv.splatnost
                ? daysOverdue(inv.splatnost, today)
                : undefined;
            return (
              <li key={inv.id}>
                <div className="flex items-stretch rounded-md border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => setInvoiceModal({ mode: "edit", invoice: inv })}
                    className="flex flex-1 min-h-tap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-subtle"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusChip status={computedStatus} daysOverdue={overdueDays} />
                        {computedStatus === "PAID" && inv.datumPlatby ? (
                          <span className="text-xs text-ink-muted whitespace-nowrap">
                            {formatDateCs(inv.datumPlatby)}
                          </span>
                        ) : null}
                        {computedStatus !== "PAID" && inv.splatnost ? (
                          <span className="text-xs text-ink-muted whitespace-nowrap">
                            {t("budget.invoice.splatnostShort")}: {formatDateCs(inv.splatnost)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-base font-semibold text-ink tabular-nums shrink-0">
                      {formatCzk(inv.castka)}
                    </span>
                  </button>
                  {inv.pdfPath ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPdf(inv.pdfPath!)}
                      aria-label={t("budget.invoice.pdfAriaOpen")}
                      title={t("budget.invoice.pdfOpen")}
                      className="grid size-tap place-items-center border-l border-line text-status-info-fg hover:bg-bg-subtle"
                    >
                      <FileText aria-hidden size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDeleteInvoiceTarget(inv)}
                    aria-label={t("budget.invoice.deleteAria", { amount: formatCzk(inv.castka) })}
                    title={t("common.delete")}
                    className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
                  >
                    <Trash2 aria-hidden size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Cenové nabídky */}
      <CollapsibleHeader
        title={t("budget.quote.listTitle")}
        count={quotesState.status === "ready" ? quotesState.quotes.length : 0}
        open={showQuotes}
        onToggle={() => setShowQuotes((s) => !s)}
        onAdd={() => setQuoteModal({ mode: "create" })}
        addLabel={t("budget.quote.addCta")}
      />
      {showQuotes ? (
        <QuotesList
          state={quotesState}
          onEdit={(q) => setQuoteModal({ mode: "edit", quote: q })}
          onDelete={(q) => setDeleteQuoteTarget(q)}
        />
      ) : null}

      {/* Mimo-fakturní výdaje */}
      <CollapsibleHeader
        title={t("budget.payment.listTitle")}
        count={paymentsState.status === "ready" ? paymentsState.payments.length : 0}
        open={showPayments}
        onToggle={() => setShowPayments((s) => !s)}
        onAdd={() => setPaymentModal({ mode: "create" })}
        addLabel={t("budget.payment.addCta")}
      />
      {showPayments ? (
        <PaymentsList
          state={paymentsState}
          onEdit={(p) => setPaymentModal({ mode: "edit", payment: p })}
          onDelete={(p) => setDeletePaymentTarget(p)}
        />
      ) : null}

      <SectionModal
        open={editSectionOpen}
        mode="edit"
        section={section}
        onClose={() => setEditSectionOpen(false)}
      />

      <ExpectedAmountModal
        open={expectedModalOpen}
        section={section}
        onClose={() => setExpectedModalOpen(false)}
      />

      {quoteModal ? (
        <QuoteModal
          open
          mode={quoteModal.mode}
          sectionId={id}
          quote={quoteModal.mode === "edit" ? quoteModal.quote : null}
          onClose={() => setQuoteModal(null)}
        />
      ) : null}

      {paymentModal ? (
        <PaymentModal
          open
          mode={paymentModal.mode}
          sectionId={id}
          payment={paymentModal.mode === "edit" ? paymentModal.payment : null}
          onClose={() => setPaymentModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteQuoteTarget}
        title={t("budget.quote.deleteConfirmTitle")}
        message={
          deleteQuoteTarget
            ? t("budget.quote.deleteConfirmBody", {
                amount: formatCzk(deleteQuoteTarget.castka),
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (deleteQuoteTarget && id) {
            try {
              await deleteQuote(id, deleteQuoteTarget.id);
            } catch (err) {
              console.error("delete quote failed", err);
              alert(t("budget.quote.errorDelete"));
            } finally {
              setDeleteQuoteTarget(null);
            }
          }
        }}
        onClose={() => setDeleteQuoteTarget(null)}
      />

      <ConfirmDialog
        open={!!deletePaymentTarget}
        title={t("budget.payment.deleteConfirmTitle")}
        message={
          deletePaymentTarget
            ? t("budget.payment.deleteConfirmBody", {
                amount: formatCzk(deletePaymentTarget.castka),
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={async () => {
          if (deletePaymentTarget && id) {
            try {
              await deletePayment(id, deletePaymentTarget.id);
            } catch (err) {
              console.error("delete payment failed", err);
              alert(t("budget.payment.errorDelete"));
            } finally {
              setDeletePaymentTarget(null);
            }
          }
        }}
        onClose={() => setDeletePaymentTarget(null)}
      />

      {invoiceModal ? (
        <InvoiceModal
          open
          mode={invoiceModal.mode}
          sectionId={id}
          invoice={invoiceModal.mode === "edit" ? invoiceModal.invoice : null}
          onClose={() => setInvoiceModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteSectionOpen}
        title={t("budget.sekce.deleteConfirmTitle")}
        message={t("budget.sekce.deleteConfirmBody", { title: section.title })}
        confirmLabel={t("budget.sekce.deleteConfirmBtn")}
        destructive
        busy={busyDelete}
        onConfirm={handleDeleteSection}
        onClose={() => setDeleteSectionOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteInvoiceTarget}
        title={t("budget.invoice.deleteConfirmTitle")}
        message={
          deleteInvoiceTarget
            ? t("budget.invoice.deleteConfirmBody", {
                amount: formatCzk(deleteInvoiceTarget.castka),
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (deleteInvoiceTarget) handleDeleteInvoice(deleteInvoiceTarget);
        }}
        onClose={() => setDeleteInvoiceTarget(null)}
      />
    </section>
  );
}

function formatDateCs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("cs-CZ");
  } catch {
    return iso;
  }
}


function CollapsibleHeader({
  title,
  count,
  open,
  onToggle,
  onAdd,
  addLabel,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 -ml-1 px-1 py-1 text-base font-semibold text-ink hover:text-ink-link"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown aria-hidden size={18} />
        ) : (
          <ChevronRightIcon aria-hidden size={18} />
        )}
        <span>
          {title}
          {count > 0 ? (
            <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-pill border border-line bg-bg-subtle px-1.5 py-0.5 text-xs text-ink-muted tabular-nums">
              {count}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-on hover:bg-accent-hover"
      >
        + {addLabel}
      </button>
    </header>
  );
}

function QuotesList({
  state,
  onEdit,
  onDelete,
}: {
  state: ReturnType<typeof useSectionQuotes>;
  onEdit: (q: BudgetQuote) => void;
  onDelete: (q: BudgetQuote) => void;
}) {
  const t = useT();
  if (state.status === "loading") {
    return <p aria-busy className="text-sm text-ink-muted">{t("budget.quote.loading")}</p>;
  }
  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
      >
        {t("budget.quote.errorLoad")}
      </p>
    );
  }
  if (state.quotes.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line bg-surface px-3 py-3 text-center text-xs text-ink-muted">
        {t("budget.quote.emptyDesc")}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {state.quotes.map((q) => (
        <li key={q.id}>
          <div className="flex items-stretch rounded-md border border-line bg-surface">
            <button
              type="button"
              onClick={() => onEdit(q)}
              className="flex flex-1 min-h-tap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-subtle"
            >
              <div className="flex flex-col gap-1 min-w-0">
                {q.supplier ? (
                  <span className="text-sm font-medium text-ink truncate">
                    {q.supplier}
                  </span>
                ) : null}
                {q.note ? (
                  <span className="text-xs text-ink-muted truncate">{q.note}</span>
                ) : null}
              </div>
              <span className="text-base font-semibold text-ink tabular-nums shrink-0">
                {formatCzk(q.castka)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(q)}
              aria-label={t("budget.quote.deleteAria", { amount: formatCzk(q.castka) })}
              title={t("common.delete")}
              className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PaymentsList({
  state,
  onEdit,
  onDelete,
}: {
  state: ReturnType<typeof useSectionPayments>;
  onEdit: (p: BudgetPayment) => void;
  onDelete: (p: BudgetPayment) => void;
}) {
  const t = useT();
  if (state.status === "loading") {
    return <p aria-busy className="text-sm text-ink-muted">{t("budget.payment.loading")}</p>;
  }
  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
      >
        {t("budget.payment.errorLoad")}
      </p>
    );
  }
  if (state.payments.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line bg-surface px-3 py-3 text-center text-xs text-ink-muted">
        {t("budget.payment.emptyDesc")}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {state.payments.map((p) => (
        <li key={p.id}>
          <div className="flex items-stretch rounded-md border border-line bg-surface">
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="flex flex-1 min-h-tap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-subtle"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-ink whitespace-nowrap">
                    {formatDateCs(p.datum)}
                  </span>
                  {p.supplier ? (
                    <span className="text-xs text-ink-muted truncate">
                      {p.supplier}
                    </span>
                  ) : null}
                </div>
                {p.note ? (
                  <span className="text-xs text-ink-muted truncate" title={p.note}>
                    {p.note}
                  </span>
                ) : null}
              </div>
              <span className="text-base font-semibold text-ink tabular-nums shrink-0">
                {formatCzk(p.castka)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(p)}
              aria-label={t("budget.payment.deleteAria", { amount: formatCzk(p.castka) })}
              title={t("common.delete")}
              className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
            >
              <Trash2 aria-hidden size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

