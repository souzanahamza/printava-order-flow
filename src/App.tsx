import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import DesignApprovals from "./pages/DesignApprovals";
import Production from "./pages/Production";
import Shipping from "./pages/Shipping";
import UsersManagement from "./pages/UsersManagement";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Team from "./pages/Team";
import StatusSettings from "./pages/StatusSettings";
import PricingSettings from "./pages/PricingSettings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Layout><Orders /></Layout></ProtectedRoute>} />
            <Route path="/new-order" element={<ProtectedRoute><Layout><NewOrder /></Layout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Layout><Clients /></Layout></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Layout><Products /></Layout></ProtectedRoute>} />
            <Route path="/design-approvals" element={<ProtectedRoute><Layout><DesignApprovals /></Layout></ProtectedRoute>} />
            <Route path="/production" element={<ProtectedRoute><Layout><Production /></Layout></ProtectedRoute>} />
            <Route path="/shipping" element={<ProtectedRoute><Layout><Shipping /></Layout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Layout><UsersManagement /></Layout></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute><Layout><Team /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/settings/statuses" element={<ProtectedRoute><Layout><StatusSettings /></Layout></ProtectedRoute>} />
            <Route path="/settings/pricing" element={<ProtectedRoute><Layout><PricingSettings /></Layout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
