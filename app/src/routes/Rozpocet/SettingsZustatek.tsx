// @deprecated R1 — currentAccountBalance feature removed.
import { Navigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
export default function SettingsZustatek() {
  return <Navigate to={ROUTES.nastaveni} replace />;
}
