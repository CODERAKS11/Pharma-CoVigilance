import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Shield, LayoutDashboard, ClipboardList, FileText, Upload, ScrollText, LogOut, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './api/auth';
import { RequireRole, getDefaultRoute } from './routes/RequireRole';
import LoginPage from './pages/Login';
import IntakePage from './pages/Intake';
import MyCasesPage from './pages/MyCases';
import QueuePage from './pages/Queue';
import DashboardPage from './pages/Dashboard';
import ExportsPage from './pages/Exports';
import AuditLogPage from './pages/Admin/AuditLog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import type { UserRole } from './api/types';

function AppContent() {
  const { user, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const role = user!.role;

  interface NavItem {
    to: string;
    icon: React.ReactNode;
    label: string;
    roles: UserRole[];
  }

  const navItems: NavItem[] = [
    { to: '/my-cases', icon: <FileText size={18} />, label: 'My Cases', roles: ['Reporter'] },
    { to: '/queue', icon: <ClipboardList size={18} />, label: 'Case Queue', roles: ['Reviewer', 'Admin'] },
    { to: '/intake', icon: <Upload size={18} />, label: 'Report Event', roles: ['Reporter', 'Admin'] },
    { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', roles: ['Admin', 'Reviewer'] },
    { to: '/exports', icon: <FileText size={18} />, label: 'Exports', roles: ['Admin', 'Reviewer'] },
    { to: '/admin/audit', icon: <ScrollText size={18} />, label: 'Audit Log', roles: ['Admin'] },
  ];

  const visibleNav = navItems.filter(item => item.roles.includes(role));

  return (
    <>
      {/* Mobile nav */}
      <div className="mobile-nav">
        <button className="mobile-nav-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} color="var(--teal-light)" />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 'var(--text-md)' }}>PharmaSafe</span>
        </div>
      </div>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`app-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Shield size={18} color="#fff" />
            </div>
            <div className="sidebar-brand-text">
              <h1>PharmaSafe</h1>
              <span>Pharmacovigilance</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Navigation</div>
            {visibleNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-sidebar-hover)',
              marginBottom: 8,
            }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#fff' }}>
                {user!.name}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)' }}>
                {user!.role} · {user!.email}
              </p>
            </div>
            <button className="sidebar-link" onClick={logout} style={{ color: 'rgba(255,255,255,0.5)' }}>
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="app-main">
          <Routes>
            <Route path="/queue" element={
              <RequireRole allowed={['Reviewer', 'Admin']}>
                <QueuePage />
              </RequireRole>
            } />
            <Route path="/intake" element={
              <RequireRole allowed={['Reporter', 'Admin']}>
                <IntakePage />
              </RequireRole>
            } />
            <Route path="/my-cases" element={
              <RequireRole allowed={['Reporter']}>
                <MyCasesPage />
              </RequireRole>
            } />
            <Route path="/dashboard" element={
              <RequireRole allowed={['Admin', 'Reviewer']}>
                <DashboardPage />
              </RequireRole>
            } />
            <Route path="/exports" element={
              <RequireRole allowed={['Admin', 'Reviewer']}>
                <ExportsPage />
              </RequireRole>
            } />
            <Route path="/admin/audit" element={
              <RequireRole allowed={['Admin']}>
                <AuditLogPage />
              </RequireRole>
            } />
            <Route path="/" element={<Navigate to={getDefaultRoute(role)} replace />} />
            <Route path="*" element={<Navigate to={getDefaultRoute(role)} replace />} />
          </Routes>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 45,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
