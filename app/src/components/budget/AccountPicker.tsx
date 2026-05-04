import { useT } from "@/i18n/useT";
import { useBudgetAccounts } from "@/hooks/useBudgetAccounts";

interface Props {
  value: string | null | undefined;
  onChange: (accountId: string | null) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function AccountPicker({
  value,
  onChange,
  disabled,
  required,
}: Props) {
  const t = useT();
  const state = useBudgetAccounts();

  if (state.status !== "ready") {
    return (
      <select
        disabled
        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink-subtle min-h-tap"
      >
        <option>{t("budget.account.loading")}</option>
      </select>
    );
  }

  return (
    <select
      required={required}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
    >
      <option value="" disabled>
        {t("budget.account.pickerPlaceholder")}
      </option>
      {state.accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label}
        </option>
      ))}
    </select>
  );
}
