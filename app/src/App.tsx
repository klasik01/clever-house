import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useUserRole } from "./hooks/useUserRole";
import Shell from "./components/Shell";
import Settings from "./routes/Settings";
import Kategorie from "./routes/Kategorie";
import KategorieDetail from "./routes/KategorieDetail";
import Lokace from "./routes/Lokace";
import Ukoly from "./routes/Ukoly";
import NewTask from "./routes/NewTask";
import Zaznamy from "./routes/Zaznamy";
import LokaceDetail from "./routes/LokaceDetail";
import Export from "./routes/Export";
import TaskDetail from "./routes/TaskDetail";
import Login from "./routes/Auth/Login";
import UpdateBanner from "./components/UpdateBanner";
import { signOut } from "./lib/auth";
import { useT } from "./i18n/useT";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <UpdateBanner />
      <Routes>
        <Route path="/auth/prihlaseni" element={<Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<LokaceForOwner />} />
          <Route path="/napady" element={<Navigate to="/zaznamy" replace />} />
          <Route path="/otazky" element={<Navigate to="/ukoly" replace />} />
          <Route path="/zaznamy" element={<Zaznamy />} />
          <Route path="/ukoly" element={<Ukoly />} />
          <Route path="/t/:id" element={<TaskDetail />} />
          <Route path="/nastaveni" element={<Settings />} />
          <Route path="/kategorie" element={<KategorieForOwner />} />
          <Route path="/kategorie/:id" element={<KategorieDetailForOwner />} />
          <Route path="/lokace/:id" element={<LokaceDetailForOwner />} />
          <Route path="/prehled" element={<Navigate to="/ukoly" replace />} />
          <Route path="/novy" element={<NewTaskForOwner />} />
          <Route path="/export" element={<ExportForOwner />} />
          <Route path="/lokace" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const t = useT();

  const roleState = useUserRole(user?.uid);

  if (loading || (user && roleState.status === "loading")) {
    return <Splash message={t("app.loading")} />;
  }

  if (!user) {
    return <Navigate to="/auth/prihlaseni" replace state={{ from: location.pathname }} />;
  }

  if (roleState.status === "missing" || roleState.status === "error") {
    return <MissingRoleScreen />;
  }

  if (roleState.status !== "ready") {
    return <Splash message={t("app.loading")} />;
  }

  return (
    <Shell role={roleState.profile.role}>
      <Outlet />
    </Shell>
  );
}

/** PM redirects away from `/export`. */
function ExportForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to="/ukoly" replace />;
  }
  return <Export />;
}

/** PM redirects away from `/kategorie`. */
function KategorieForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to="/ukoly" replace />;
  }
  return <Kategorie />;
}

/** PM redirects away from `/kategorie/:id`. */
function KategorieDetailForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to="/ukoly" replace />;
  }
  return <KategorieDetail />;
}

/** PM redirects away from `/lokace`. */
function LokaceForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to="/ukoly" replace />;
  }
  return <Lokace />;
}

/** PM redirects away from `/novy`. */
function NewTaskForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to="/ukoly" replace />;
  }
  return <NewTask />;
}

/** PM redirects away from `/lokace/:id`. */
function LokaceDetailForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to="/ukoly" replace />;
  }
  return <LokaceDetail />;
}

function Splash({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-dvh place-items-center bg-bg text-ink-subtle"
    >
      <span className="text-sm">{message}</span>
    </div>
  );
}

function MissingRoleScreen() {
  const t = useT();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 pt-safe pb-safe">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink">{t("role.missingTitle")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("role.missingBody")}</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          {t("role.signOut")}
        </button>
      </div>
    </main>
  );
}
