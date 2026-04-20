import { useMemo, useState } from "react";
import { Download, FileText, Share2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useCategories } from "@/hooks/useCategories";
import CategoryFilterChip from "@/components/CategoryFilterChip";
import LocationFilterChip from "@/components/LocationFilterChip";
import { applyCategory, applyLocation } from "@/lib/filters";
import { getLocation } from "@/lib/locations";
import { tasksToPlainText } from "@/lib/textExport";
import { generateTasksPdfBlob } from "@/lib/pdf";
import type { Task } from "@/types";

type Preset = "open" | "allOpen" | "custom";

export default function Export() {
  const t = useT();
  const { user } = useAuth();
  const { tasks, loading } = useTasks(Boolean(user));
  const { categories } = useCategories(Boolean(user));
  const [preset, setPreset] = useState<Preset>("open");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Only otázky go into an export (Projektant doesn't need nápady).
  const otazky = useMemo(() => tasks.filter((x) => x.type === "otazka"), [tasks]);

  const filtered = useMemo<Task[]>(() => {
    let base = otazky;
    if (preset === "open") {
      base = base.filter((x) => x.status === "Otázka" || x.status === "Čekám");
    } else if (preset === "allOpen") {
      base = base.filter((x) => x.status !== "Hotovo");
    }
    // custom: no status filter, only category+location
    base = applyLocation(applyCategory(base, categoryId), locationId);
    return base;
  }, [otazky, preset, categoryId, locationId]);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const blob = await generateTasksPdfBlob({
        tasks: filtered,
        categories,
        title: t("export.pdfTitle"),
        subtitle: t("export.pdfSubtitle"),
      });
      const date = new Date().toISOString().slice(0, 10);
      const filename = t("export.pdfFilename", { date });
      const file = new File([blob], filename, { type: "application/pdf" });

      // Try Web Share API first (iOS/Android)
      // Some browsers only expose share for files under specific flags — guard with canShare
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: t("export.pdfTitle"),
          });
          return;
        } catch {
          // User cancelled, or share failed — fall through to download
        }
      }

      // Fallback: trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      console.error("pdf generation failed", e);
      setError(t("export.pdfError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyAsText() {
    const text = tasksToPlainText(filtered, categories, t("export.pdfTitle"));
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("clipboard failed", e);
    }
  }

  const presets: { id: Preset; label: string; hint: string }[] = [
    { id: "open", label: t("export.presetOpen"), hint: t("export.presetOpenHint") },
    { id: "allOpen", label: t("export.presetAllOpen"), hint: t("export.presetAllOpenHint") },
    { id: "custom", label: t("export.presetCustom"), hint: t("export.presetCustomHint") },
  ];

  return (
    <section
      aria-labelledby="export-heading"
      className="mx-auto max-w-xl px-4 py-4"
    >
      <h2 id="export-heading" className="text-xl font-semibold tracking-tight text-ink">
        {t("export.pageTitle")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{t("export.pageHint")}</p>

      <fieldset className="mt-6" aria-label={t("export.presetLabel")}>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("export.presetLabel")}
        </legend>
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <label
              key={p.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition-colors",
                preset === p.id
                  ? "border-accent bg-bg-subtle"
                  : "border-line bg-surface hover:bg-bg-subtle",
              ].join(" ")}
            >
              <input
                type="radio"
                name="preset"
                value={p.id}
                checked={preset === p.id}
                onChange={() => setPreset(p.id)}
                className="mt-1 accent-[color:var(--color-accent-default)]"
              />
              <div>
                <p className="text-sm font-medium text-ink">{p.label}</p>
                <p className="text-xs text-ink-muted">{p.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CategoryFilterChip
          value={categoryId}
          categories={categories}
          onChange={setCategoryId}
        />
        <LocationFilterChip value={locationId} onChange={setLocationId} />
      </div>

      <p className="mt-4 text-sm font-medium text-ink">
        {t("export.count", { n: filtered.length })}
      </p>

      {filtered.length > 0 && (
        <div className="mt-3" aria-labelledby="preview-heading">
          <h3 id="preview-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t("export.previewLabel")}
          </h3>
          <ul className="divide-y divide-line rounded-md bg-surface ring-1 ring-line">
            {filtered.slice(0, 5).map((task) => (
              <PreviewRow key={task.id} task={task} categories={categories} />
            ))}
          </ul>
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <p className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
          {t("export.noTasks")}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleCopyAsText}
          disabled={filtered.length === 0 || busy}
          className="inline-flex items-center justify-center gap-2 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
        >
          <FileText aria-hidden size={16} />
          {copied ? t("export.copied") : t("export.copyAsText")}
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={filtered.length === 0 || busy}
          className="inline-flex items-center justify-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          {busy ? (
            <>
              <Download aria-hidden size={16} className="animate-pulse" />
              {t("export.generating")}
            </>
          ) : (
            <>
              <Share2 aria-hidden size={16} />
              {t("export.generate")}
            </>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-status-danger-fg)]">
          {error}
        </p>
      )}
    </section>
  );
}

function PreviewRow({
  task,
  categories,
}: {
  task: Task;
  categories: Array<{ id: string; label: string }>;
}) {
  const category = task.categoryId
    ? categories.find((c) => c.id === task.categoryId)?.label
    : null;
  const location = getLocation(task.locationId)?.label ?? null;
  const preview = (task.body || task.title || "").trim().slice(0, 140);
  return (
    <li className="px-4 py-3">
      <p className="text-sm text-ink truncate">{preview}</p>
      <p className="mt-1 text-xs text-ink-subtle">
        {task.status}
        {category ? ` · ${category}` : ""}
        {location ? ` · ${location}` : ""}
      </p>
    </li>
  );
}
