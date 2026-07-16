import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../api/auth';
import type { UserRole } from '../api/types';

interface RequireRoleProps {
  allowed: UserRole[];
  children: React.ReactNode;
}

export function RequireRole({ allowed, children }: RequireRoleProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowed.includes(user.role)) {
    // Redirect to their default landing page
    const defaultRoute = user.role === 'Reporter' ? '/intake' : user.role === 'Reviewer' ? '/queue' : '/dashboard';
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'Reporter': return '/intake';
    case 'Reviewer': return '/queue';
    case 'Admin': return '/dashboard';
  }
}
