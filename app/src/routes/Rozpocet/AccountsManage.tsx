import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useBudgetAccounts } from "@/hooks/useBudgetAccounts";
import { deleteAccount, ensureDefaultAccounts } from "@/lib/budget/accounts";
import AccountModal from "@/components/budget/AccountModal";
import AccountBadge from "@/components/budget/AccountBadge";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { ROUTES } from "@/lib/routes";
import type { BudgetAccount } from "@/types";

export default function AccountsManage() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useBudgetAccounts();

  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; account: BudgetAccount }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetAccount | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Při prvním načtení (žádné účty) inicializuj 3 default — Discovery defaults.
  useEffect(() => {
    if (
      state.status === "ready" &&
      state.accounts.length === 0 &&
      user &&
      !bootstrapped
    ) {
      setBootstrapped(true);
      void ensureDefaultAccounts(user.uid).catch((err) => {
        console.error("ensureDefaultAccounts failed", err);
      });
    }
  }, [state, user, bootstrapped]);

  async function handleDelete(a: BudgetAccount) {
    try {
      await deleteAccount(a.id);
    } catch (err) {
      console.error("delete account failed", err);
      alert(t("budget.account.errorDelete"));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <section
      aria-labelledby="rozpocet-accounts-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <button
        type="button"
        onClick={() => navigate(ROUTES.nastaveni)}
        className="inline-flex items-center gap-1 -ml-2 px-2 py-1 text-sm text-ink-link hover:text-ink-link-hover"
      >
        <ArrowLeft aria-hidden size={16} />
        {t("settings.title")}
      </button>

      <header className="flex items-center justify-between gap-3">
        <h2
          id="rozpocet-accounts-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.account.manageTitle")}
        </h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          <Plus aria-hidden size={16} />
          {t("budget.account.addCta")}
        </button>
      </header>

      <p className="text-sm text-ink-muted leading-relaxed">
        {t("budget.account.intro")}
      </p>

      {state.status === "loading" ? (
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.account.loading")}
        </p>
      ) : state.status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.account.errorLoad")}
        </p>
      ) : state.accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
          {t("budget.account.bootstrapping")}
        </p>
      ) : (
        <ul className="space-y-2">
          {state.accounts.map((a) => (
            <li key={a.id}>
              <div className="flex items-stretch rounded-md border border-line bg-surface">
                <div className="flex flex-1 items-center gap-3 px-4 py-3">
                  <AccountBadge account={a} />
                  <span className="text-sm text-ink truncate flex-1">{a.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "edit", account: a })}
                  aria-label={t("budget.account.editAria", { label: a.label })}
                  className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
                >
                  <Pencil aria-hidden size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(a)}
                  aria-label={t("budget.account.deleteAria", { label: a.label })}
                  className="grid size-tap place-items-center border-l border-line text-ink-muted hover:bg-bg-subtle"
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <AccountModal
          open
          mode={modal.mode}
          account={modal.mode === "edit" ? modal.account : null}
          onClose={() => setModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("budget.account.deleteConfirmTitle")}
        message={
          deleteTarget
            ? t("budget.account.deleteConfirmBody", { label: deleteTarget.label })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}
