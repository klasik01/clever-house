/**
 * Minimal i18n for S01. CZ-only. In V2, swap for react-intl / i18next
 * without touching call sites — the shape `t('ns.key', { n: 5 })` stays.
 */
import cs from "./cs.json";

type Dict = Record<string, unknown>;
type Vars = Record<string, string | number>;

function get(dict: Dict, key: string): string {
  const parts = key.split(".");
  let node: unknown = dict;
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Dict)) {
      node = (node as Dict)[p];
    } else {
      return key; // fallback: show the key so missing strings are obvious
    }
  }
  return typeof node === "string" ? node : key;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

/** Signature of the translator function returned by `useT()`. */
export type TFn = (key: string, vars?: Vars) => string;

export function useT(): TFn {
  return (key: string, vars?: Vars): string =>
    interpolate(get(cs as Dict, key), vars);
}

/** Formatter for relative-time strings like "před 5 min". */
export function formatRelative(
  t: ReturnType<typeof useT>,
  when: Date
): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - when.getTime()) / 1000));
  if (diffSec < 60) return t("card.justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("card.minutesAgo", { n: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("card.hoursAgo", { n: diffHr });
  const diffD = Math.floor(diffHr / 24);
  return t("card.daysAgo", { n: diffD });
}
