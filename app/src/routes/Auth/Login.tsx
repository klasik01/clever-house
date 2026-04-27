import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { LogIn } from "lucide-react";
import { signInEmail, signInGoogle } from "@/lib/auth";
import { useT } from "@/i18n/useT";

export default function Login() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInEmail(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(messageFromError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await signInGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(messageFromError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 pt-safe pb-safe">
      <header className="text-center">
        <div
          aria-hidden
          className="mx-auto mb-4 grid size-14 place-items-center rounded-xl bg-accent text-accent-on shadow-md"
        >
          <LogIn size={24} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("auth.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{t("auth.subtitle")}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
        aria-label={t("auth.title")}
      >
        <Field
          id="email"
          type="email"
          label={t("auth.email")}
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          id="password"
          type="password"
          label={t("auth.password")}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 min-h-tap rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-on hover:bg-accent-hover active:bg-accent-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
        >
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        {error && (
          <p role="alert" className="text-sm text-[color:var(--color-status-danger-fg)]">
            {error}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-subtle">
        <span className="h-px flex-1 bg-line" />
        <span>{t("auth.or")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        className="min-h-tap rounded-md border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
      >
        {t("auth.signInGoogle")}
      </button>

      <p className="text-center text-xs text-ink-subtle">
        {t("auth.noAccount")}
      </p>
    </main>
  );
}

function Field({
  id,
  type,
  label,
  value,
  onChange,
  autoComplete,
  required,
}: {
  id: string;
  type: "email" | "password" | "text";
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm text-ink">
      <span className="font-medium">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
      />
    </label>
  );
}

function messageFromError(err: unknown, t: ReturnType<typeof useT>): string {
  if (err instanceof FirebaseError) {
    if (
      err.code === "auth/invalid-credential" ||
      err.code === "auth/wrong-password" ||
      err.code === "auth/user-not-found"
    ) {
      return t("auth.invalidCredentials");
    }
  }
  return t("auth.genericError");
}
