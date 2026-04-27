import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useRegisterFcm } from "./hooks/useRegisterFcm";
import { useSwNavigate } from "./hooks/useSwNavigate";
import { useAppBadge } from "./hooks/useAppBadge";
import Events from "./routes/Events";
import EventComposer from "./routes/EventComposer";
import EventDetail from "./routes/EventDetail";
import { useDeviceRegistrationSanity } from "./hooks/useDeviceRegistrationSanity";
import { useInbox } from "./hooks/useInbox";
import { useInboxAutoRead } from "./hooks/useInboxAutoRead";
import { useUserRole } from "./hooks/useUserRole";
import Shell from "./components/Shell";
import Settings from "./routes/Settings";
import Kategorie from "./routes/Kategorie";
import KategorieDetail from "./routes/KategorieDetail";
import Lokace from "./routes/Lokace";
import LokaceManage from "./routes/LokaceManage";
import DocumentTypesManage from "./routes/DocumentTypesManage";
import Rozpocet from "./routes/Rozpocet";
import Harmonogram from "./routes/Harmonogram";
import Ukoly from "./routes/Ukoly";
import NewTask from "./routes/NewTask";
import Zaznamy from "./routes/Zaznamy";
import LokaceDetail from "./routes/LokaceDetail";
import Export from "./routes/Export";
import TaskDetail from "./routes/TaskDetail";
import Login from "./routes/Auth/Login";
import UpdateBanner from "./components/UpdateBanner";
import { BusyProvider } from "./components/BusyOverlay";
import { signOut } from "./lib/auth";
import { useT } from "./i18n/useT";
import { ROUTES, ROUTE_PATTERNS } from "./lib/routes";

export default function App() {
  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "")}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <BusyProvider>
        <UpdateBanner />
        <Routes>
        <Route path={ROUTES.login} element={<Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path={ROUTES.home} element={<LokaceForOwner />} />
          <Route path={ROUTES.legacyNapady} element={<Navigate to={ROUTES.zaznamy} replace />} />
          <Route path={ROUTES.legacyOtazky} element={<Navigate to={ROUTES.ukoly} replace />} />
          <Route path={ROUTES.zaznamy} element={<Zaznamy />} />
          <Route path={ROUTES.ukoly} element={<Ukoly />} />
        <Route path={ROUTES.events} element={<Events />} />
        <Route path={ROUTES.eventsNew} element={<EventComposer />} />
        <Route path={ROUTE_PATTERNS.eventDetail} element={<EventDetail />} />
        <Route path={ROUTE_PATTERNS.eventEdit} element={<EventComposer />} />
          <Route path={ROUTE_PATTERNS.taskDetail} element={<TaskDetail />} />
          <Route path={ROUTES.nastaveni} element={<Settings />} />
          <Route path={ROUTES.kategorie} element={<KategorieForOwner />} />
          <Route path={ROUTES.nastaveniLokace} element={<LokaceManageForOwner />} />
          <Route path={ROUTES.nastaveniTypyDokumentu} element={<DocTypesForOwner />} />
          <Route path={ROUTES.rozpocet} element={<RozpocetForPm />} />
          <Route path={ROUTES.harmonogram} element={<HarmonogramForPm />} />
          <Route path={ROUTE_PATTERNS.kategorieDetail} element={<KategorieDetailForOwner />} />
          <Route path={ROUTE_PATTERNS.lokaceDetail} element={<LokaceDetailForOwner />} />
          <Route path={ROUTES.legacyPrehled} element={<Navigate to={ROUTES.ukoly} replace />} />
          <Route path={ROUTES.novyTask} element={<NewTaskForOwner />} />
          <Route path={ROUTES.export} element={<ExportForOwner />} />
          <Route path={ROUTES.lokace} element={<Navigate to={ROUTES.home} replace />} />
          <Route path={ROUTE_PATTERNS.catchAll} element={<Navigate to={ROUTES.home} replace />} />
        </Route>
        </Routes>
      </BusyProvider>
    </BrowserRouter>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const t = useT();

  const roleState = useUserRole(user?.uid);
  // V15 — keep FCM token in Firestore aligned with the signed-in user.
  // Only acts if Notification.permission === "granted"; the initial
  // permission request is driven by the banner / Settings (slice N-3).
  useRegisterFcm(user?.uid ?? null);
  // V17.4 — pokud permission=granted ale device doc v Firestore chybí
  //   (zombie cleanup, token expirace, clear site data), tiše znovu
  //   zaregistruj. Bez tohoto user má "granted" bez reálného doručování.
  useDeviceRegistrationSanity(user?.uid ?? null);
  // V15/N-5 — bridge SW NAVIGATE messages (from notification click) into
  // React Router so deep links soft-navigate instead of full-reloading.
  useSwNavigate();
  // V15.1/N-22 — drive the iOS home-screen app badge off the real unread
  // count of in-app notifications. SW still bumps it to "1" on push arrival
  // (before the app is open), and this hook overwrites with the true number
  // the moment the app mounts or reconnects to Firestore.
  const { items, unreadCount } = useInbox(user?.uid ?? null);
  useAppBadge(unreadCount);
  // V16.9 — když jsem aktivně na /t/{taskId} a dorazí unread inbox item
  // pro ten task, automaticky ho mark-readnu. SW zvlášť suppressne push
  // popup (viz firebaseMessagingSw plugin ve vite.config.ts).
  useInboxAutoRead(user?.uid ?? null, items);

  if (loading || (user && roleState.status === "loading")) {
    return <Splash message={t("app.loading")} />;
  }

  if (!user) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
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
    return <Navigate to={ROUTES.ukoly} replace />;
  }
  return <Export />;
}

/** OWNER redirects away from `/harmonogram` — PM-only feature for V11.1. */
function HarmonogramForPm() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "OWNER") {
    return <Navigate to={ROUTES.home} replace />;
  }
  return <Harmonogram />;
}

/** OWNER redirects away from `/rozpocet` — PM-only feature for V11. */
function RozpocetForPm() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "OWNER") {
    return <Navigate to={ROUTES.home} replace />;
  }
  return <Rozpocet />;
}

/** PM redirects away from `/nastaveni/lokace`. */
function LokaceManageForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to={ROUTES.ukoly} replace />;
  }
  return <LokaceManage />;
}


/** PM redirects away from `/nastaveni/typy-dokumentu`. */
function DocTypesForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to={ROUTES.ukoly} replace />;
  }
  return <DocumentTypesManage />;
}
/** PM redirects away from `/kategorie`. */
function KategorieForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to={ROUTES.ukoly} replace />;
  }
  return <Kategorie />;
}

/** PM redirects away from `/kategorie/:id`. */
function KategorieDetailForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to={ROUTES.ukoly} replace />;
  }
  return <KategorieDetail />;
}

/** PM redirects away from `/lokace`. */
function LokaceForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to={ROUTES.ukoly} replace />;
  }
  return <Lokace />;
}

/** V10 — both OWNER and PM can create tasks. (Kept wrapper name for callsite stability.) */
function NewTaskForOwner() {
  return <NewTask />;
}

/** PM redirects away from `/lokace/:id`. */
function LokaceDetailForOwner() {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  if (roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER") {
    return <Navigate to={ROUTES.ukoly} replace />;
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
