import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { profile, loading, user } = useAuth();
  // Show loading spinner while auth is loading OR user is authenticated but profile hasn't loaded yet
  if (loading || (user && !profile)) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
