import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useBudgetSection } from "@/hooks/useBudgetSections";
import { useSectionInvoices } from "@/hooks/useSectionInvoices";
import {
  computeSectionOpenTotal,
  computeSectionPaidTotal,
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
import { getInvoicePdfUrl } from "@/lib/budget/storage";
import SectionModal from "@/components/budget/SectionModal";
import InvoiceModal from "@/components/budget/InvoiceModal";
import StatusChip from "@/components/budget/StatusChip";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { rozpocetSekce } from "@/lib/routes";
import type { BudgetInvoice } from "@/types";

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
  const [deleteSectionOpen, setDeleteSectionOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; invoice: BudgetInvoice }
    | null
  >(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] =
    useState<BudgetInvoice | null>(null);

  const totals = useMemo(() => {
    if (invoicesState.status !== "ready") return { paid: 0, open: 0 };
    return {
      paid: computeSectionPaidTotal(invoicesState.invoices),
      open: computeSectionOpenTotal(invoicesState.invoices),
    };
  }, [invoicesState]);

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

      <SectionModal
        open={editSectionOpen}
        mode="edit"
        section={section}
        onClose={() => setEditSectionOpen(false)}
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
