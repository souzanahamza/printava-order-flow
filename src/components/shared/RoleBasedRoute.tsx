import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

export function RoleBasedRoute({ children, allowedRoles, redirectTo = '/production' }: RoleBasedRouteProps) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no specific roles required, allow access
  if (!allowedRoles) {
    return <>{children}</>;
  }

  // Check if user's role is in the allowed list
  if (role && allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  // Redirect if not allowed
  return <Navigate to={redirectTo} replace />;
}
