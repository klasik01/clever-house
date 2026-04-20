import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--color-bg-default)",
          subtle: "var(--color-bg-subtle)",
          muted: "var(--color-bg-muted)",
          inverse: "var(--color-bg-inverse)",
        },
        surface: {
          DEFAULT: "var(--color-surface-default)",
          raised: "var(--color-surface-raised)",
          overlay: "var(--color-surface-overlay)",
        },
        ink: {
          DEFAULT: "var(--color-text-default)",
          muted: "var(--color-text-muted)",
          subtle: "var(--color-text-subtle)",
          inverse: "var(--color-text-inverse)",
          link: "var(--color-text-link)",
        },
        line: {
          DEFAULT: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
          focus: "var(--color-border-focus)",
        },
        accent: {
          DEFAULT: "var(--color-accent-default)",
          hover: "var(--color-accent-hover)",
          active: "var(--color-accent-active)",
          on: "var(--color-accent-on-accent)",
          visual: "var(--color-accent-visual)",
        },
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        none: "0",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      minHeight: { tap: "var(--tap-target-min)" },
      minWidth: { tap: "var(--tap-target-min)" },
    },
  },
  plugins: [],
};

export default config;
