import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

export function RoleBasedRoute({ children, allowedRoles, redirectTo = '/production-tasks' }: RoleBasedRouteProps) {
  const { roles, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!allowedRoles) {
    return <>{children}</>;
  }

  if (roles.some((r) => allowedRoles.includes(r))) {
    return <>{children}</>;
  }

  return <Navigate to={redirectTo} replace />;
}
