import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RoleGuard } from "@/components/RoleGuard";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import DayViewPage from "./pages/DayViewPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import CheckInPage from "./pages/CheckInPage";
import ReviewUploadPage from "./pages/ReviewUploadPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ContentAdminPage from "./pages/ContentAdminPage";
import NotificationsPage from "./pages/NotificationsPage";
import GMOverviewPage from "./pages/GMOverviewPage";
import CorporateDashboardPage from "./pages/CorporateDashboardPage";
import StoreDetailPage from "./pages/StoreDetailPage";
import ReportsPage from "./pages/ReportsPage";
import HRAdminPage from "./pages/HRAdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/day/:dayNumber" element={<ProtectedRoute><DayViewPage /></ProtectedRoute>} />
      <Route path="/checkin/:programId/:dayNumber" element={<ProtectedRoute><RoleGuard allowedRoles={['sales_manager', 'gm', 'corporate_admin']}><CheckInPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/review/:uploadId" element={<ProtectedRoute><RoleGuard allowedRoles={['sales_manager', 'gm', 'corporate_admin']}><ReviewUploadPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><PlaceholderPage title="My Progress" /></ProtectedRoute>} />
      <Route path="/content" element={<ProtectedRoute><PlaceholderPage title="Content Library" /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><RoleGuard allowedRoles={['sales_manager', 'corporate_admin']}><ManagerDashboardPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/reviews" element={<ProtectedRoute><PlaceholderPage title="Reviews" /></ProtectedRoute>} />
      <Route path="/stores" element={<ProtectedRoute><RoleGuard allowedRoles={['gm', 'corporate_admin']}><GMOverviewPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/store/:storeId" element={<ProtectedRoute><RoleGuard allowedRoles={['gm', 'corporate_admin']}><StoreDetailPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><RoleGuard allowedRoles={['gm', 'corporate_admin', 'hr_admin']}><ReportsPage /></RoleGuard></ProtectedRoute>} />
      <Route path="/content-admin" element={<ProtectedRoute><RoleGuard allowedRoles={['corporate_admin']}><ContentAdminPage /></RoleGuard></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
