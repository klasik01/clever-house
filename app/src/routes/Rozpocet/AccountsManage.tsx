// @deprecated R2 — Account system removed; redirect to Settings landing.
import { Navigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
export default function AccountsManage() {
  return <Navigate to={ROUTES.nastaveni} replace />;
}
