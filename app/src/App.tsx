import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Shell from "./components/Shell";
import Home from "./routes/Home";
import Otazky from "./routes/Otazky";
import Settings from "./routes/Settings";
import TaskDetail from "./routes/TaskDetail";
import Login from "./routes/Auth/Login";
import { useT } from "./i18n/useT";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/prihlaseni" element={<Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/otazky" element={<Otazky />} />
          <Route path="/t/:id" element={<TaskDetail />} />
          <Route path="/nastaveni" element={<Settings />} />
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

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid min-h-dvh place-items-center bg-bg text-ink-subtle"
      >
        <span className="text-sm">{t("app.loading")}</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/prihlaseni" replace state={{ from: location.pathname }} />;
  }

  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
