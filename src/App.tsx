import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
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
      <Route path="/checkin/:programId/:dayNumber" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
      <Route path="/review/:uploadId" element={<ProtectedRoute><ReviewUploadPage /></ProtectedRoute>} />
      <Route path="/progress" element={<ProtectedRoute><PlaceholderPage title="My Progress" /></ProtectedRoute>} />
      <Route path="/content" element={<ProtectedRoute><PlaceholderPage title="Content Library" /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><PlaceholderPage title="Notifications" /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><ManagerDashboardPage /></ProtectedRoute>} />
      <Route path="/reviews" element={<ProtectedRoute><PlaceholderPage title="Reviews" /></ProtectedRoute>} />
      <Route path="/stores" element={<ProtectedRoute><PlaceholderPage title="Stores" /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><PlaceholderPage title="Reports" /></ProtectedRoute>} />
      <Route path="/content-admin" element={<ProtectedRoute><ContentAdminPage /></ProtectedRoute>} />
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
