import type { BudgetAccount } from "@/types";

interface Props {
  account: BudgetAccount | undefined;
}

export default function AccountBadge({ account }: Props) {
  if (!account) return null;

  let style: React.CSSProperties;
  switch (account.kind) {
    case "BEZNY":
      style = {
        background: "var(--color-account-bezny-bg)",
        color: "var(--color-account-bezny-fg)",
        borderColor: "var(--color-account-bezny-border)",
      };
      break;
    case "HYPOTECNI":
      style = {
        background: "var(--color-account-hypotecni-bg)",
        color: "var(--color-account-hypotecni-fg)",
        borderColor: "var(--color-account-hypotecni-border)",
      };
      break;
    case "HOTOVOST":
      style = {
        background: "var(--color-account-hotovost-bg)",
        color: "var(--color-account-hotovost-fg)",
        borderColor: "var(--color-account-hotovost-border)",
      };
      break;
    case "CUSTOM":
    default:
      style = {
        background: "var(--color-account-custom-bg)",
        color: "var(--color-account-custom-fg)",
        borderColor: "var(--color-account-custom-border)",
      };
  }
  return (
    <span
      className="inline-block rounded-pill border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={style}
    >
      {account.label}
    </span>
  );
}
