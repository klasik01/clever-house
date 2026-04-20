import { Monitor, Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useTheme } from "@/hooks/useTheme";
import type { ThemePreference } from "@/lib/theme";

interface Option {
  id: ThemePreference;
  label: string;
  icon: React.ReactNode;
}

export default function ThemeToggle() {
  const t = useT();
  const { theme, setTheme } = useTheme();

  const options: Option[] = [
    { id: "system", label: t("settings.themeSystem"), icon: <Monitor aria-hidden size={16} /> },
    { id: "light", label: t("settings.themeLight"), icon: <Sun aria-hidden size={16} /> },
    { id: "dark", label: t("settings.themeDark"), icon: <Moon aria-hidden size={16} /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.themeLabel")}
      className="flex gap-1 rounded-md bg-bg-subtle/60 p-1"
    >
      {options.map((opt) => {
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.id)}
            className={[
              "flex-1 inline-flex items-center justify-center gap-1.5 min-h-tap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast",
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-subtle hover:text-ink",
            ].join(" ")}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
