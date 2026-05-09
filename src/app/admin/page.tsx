import { isAdminFromCookie } from "@/lib/admin-auth";
import AdminPanel from "./AdminPanel";
import AdminLoginForm from "./AdminLoginForm";

// Server Component: gates the admin UI behind a real cookie-validated session.
// If the cookie is missing or invalid, we render a login form instead of the
// panel — so unauthenticated visitors can't even see the admin UI shell.
export default async function AdminPage() {
  const isAdmin = await isAdminFromCookie();
  if (!isAdmin) {
    return <AdminLoginForm />;
  }
  return <AdminPanel />;
}
