import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBasedRoute } from "@/components/RoleBasedRoute";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import DesignApprovals from "./pages/DesignApprovals";
import Production from "./pages/Production";
import Shipping from "./pages/Shipping";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Team from "./pages/Team";
import StatusSettings from "./pages/StatusSettings";
import PricingSettings from "./pages/PricingSettings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Component to handle role-based redirects from home
function HomeRedirect() {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Production users go directly to production page
  if (role === 'production') {
    return <Navigate to="/production" replace />;
  }

  // Everyone else sees dashboard
  return <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Home - redirects based on role */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HomeRedirect />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Protected routes with role restrictions */}
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin', 'sales', 'designer', 'accountant', 'production']}>
                    <Layout><Orders /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/new-order"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin', 'sales']}>
                    <Layout><NewOrder /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin', 'sales', 'accountant']}>
                    <Layout><Clients /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin', 'sales', 'accountant', 'production']}>
                    <Layout><Products /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/production"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin', 'production']}>
                    <Layout><Production /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin-only routes */}
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin']}>
                    <Layout><Team /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin']}>
                    <Layout><Settings /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings/statuses"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin']}>
                    <Layout><StatusSettings /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings/pricing"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allowedRoles={['admin']}>
                    <Layout><PricingSettings /></Layout>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            {/* Legacy routes - kept for backward compatibility */}
            <Route path="/design-approvals" element={<ProtectedRoute><Layout><DesignApprovals /></Layout></ProtectedRoute>} />
            <Route path="/shipping" element={<ProtectedRoute><Layout><Shipping /></Layout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
