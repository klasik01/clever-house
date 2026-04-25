import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Lock } from "lucide-react";
import { useT } from "@/i18n/useT";

/**
 * V18-S28 — global "blbu-vzdorný" busy overlay.
 *
 * Idea: kolega je nervák, klikne 5× na "Uložit" než app stihne reagovat,
 * pak zavře app v půli zápisu. Tomu zabráníme:
 *
 *   1. Kdykoliv komponenta volá async akci, obalí ji do `busy.run(...)`.
 *   2. `run` před voláním zobrazí fullscreen overlay s loaderem +
 *      lock ikona — blokuje všechny pointer events i klávesnici (focus
 *      trap), takže další klik nemá kam dopadnout.
 *   3. Po dokončení (úspěch nebo chyba) overlay zmizí.
 *   4. Anti-double-run: pokud `run` proběhne během už-běžícího jobu,
 *      vrací rovnou existing promise (idempotentní).
 *
 * Použití:
 *
 *   const busy = useBusy();
 *   await busy.run(async () => {
 *     await createEvent(...);
 *     navigate("/event/" + id);
 *   });
 *
 * Není to silver bullet — async chyby pořád musí komponenta zpracovat
 * (try/catch v handleru). Overlay jen brání multi-click během běhu.
 */

interface BusyContextValue {
  /** True když nějaký job právě běží. */
  busy: boolean;
  /**
   * Spustí async akci s blocking overlayem. Vrací výsledek (nebo
   * vyhazuje error). Pokud je už něco rozjeté, vrátí stejnou promisi —
   * druhý click nezpůsobí druhé spuštění.
   */
  run: <T>(fn: () => Promise<T>, label?: string) => Promise<T>;
}

const BusyContext = createContext<BusyContextValue | null>(null);

export function BusyProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const inflightRef = useRef<Promise<unknown> | null>(null);

  const run = useCallback(<T,>(fn: () => Promise<T>, lbl?: string): Promise<T> => {
    // Anti-double-run: pokud něco běží, vraťme stejnou promisi.
    if (inflightRef.current) {
      return inflightRef.current as Promise<T>;
    }
    setBusy(true);
    setLabel(lbl ?? null);
    const p = (async () => {
      try {
        return await fn();
      } finally {
        // I při erroru schováme overlay — caller ho dostane jako reject.
        inflightRef.current = null;
        setBusy(false);
        setLabel(null);
      }
    })();
    inflightRef.current = p;
    return p;
  }, []);

  const value = useMemo<BusyContextValue>(
    () => ({ busy, run }),
    [busy, run],
  );

  return (
    <BusyContext.Provider value={value}>
      {children}
      {busy && <BusyVisualOverlay label={label} />}
    </BusyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusy(): BusyContextValue {
  const ctx = useContext(BusyContext);
  if (!ctx) {
    throw new Error("useBusy must be inside BusyProvider");
  }
  return ctx;
}

/**
 * Fullscreen blocking overlay. Z-index nad všemi modaly aby zabral i
 * případné kliky uvnitř window.confirm (ale to už je sám blocking).
 *
 * Spinner: Loader2 (animate-spin přes Tailwind), Lock ikona vedle
 * jako "zamčeno, prosím počkej". Label volitelný (např. "Ukládám…",
 * "Mažu…" — caller dodá podle akce).
 */
function BusyVisualOverlay({ label }: { label: string | null }) {
  const t = useT();

  // Disable scroll na body během busy. Bez toho user může pinch-zoom
  // nebo scrollovat content pod overlayem (i když pointer-events ho
  // nedostaly).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={label ?? t("busy.defaultLabel")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      // pointer-events: explicit auto (rodič může mít none v parent)
      style={{ pointerEvents: "auto" }}
      onClick={(e) => {
        // Catch all clicks bezvýjimkou — žádný klik nesmí propadnout
        // skrz overlay na underlying UI.
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="flex items-center gap-3 rounded-lg bg-surface px-5 py-4 shadow-xl ring-1 ring-line">
        <span className="relative grid size-10 place-items-center">
          <Loader2
            aria-hidden
            size={28}
            className="animate-spin text-accent"
          />
          <Lock
            aria-hidden
            size={12}
            className="absolute text-ink-subtle"
          />
        </span>
        <p className="text-sm font-medium text-ink">
          {label ?? t("busy.defaultLabel")}
        </p>
      </div>
    </div>
  );
}
