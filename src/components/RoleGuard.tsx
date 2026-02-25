import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { profile, loading, user } = useAuth();
  if (loading || (user && !profile)) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!profile) return <Navigate to="/" replace />;
  // Check both the normalized role and legacy names for backward compat
  const normalized = normalizeRole(profile.role);
  if (!allowedRoles.includes(normalized) && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
