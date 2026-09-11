import { ClipboardList, FileClock, Gauge, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, Drawer, cn } from '../../../components/ui/primitives';
import { useAuth } from '../auth/AuthProvider';

const navigation = [
  { to: '/admin', label: 'Обзор', icon: Gauge, end: true },
  { to: '/admin/config', label: 'Конфигурация', icon: Settings2 },
  { to: '/admin/versions', label: 'Версии', icon: FileClock },
  { to: '/admin/audit', label: 'Журнал действий', icon: ClipboardList },
];

function Navigation({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <nav className="sidebar-nav" aria-label="Административная навигация">
      {navigation.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link--active')}
          onClick={onNavigate}
          aria-label={collapsed ? label : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className={cn('admin-shell', sidebarCollapsed && 'admin-shell--collapsed')}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="app-mark" aria-hidden="true">ВШ</span>
          <div>
            <strong>Воздушный Шар</strong>
            <span>Администрирование</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-collapse"
          aria-label={sidebarCollapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'}
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span>{sidebarCollapsed ? 'Развернуть' : 'Свернуть'}</span>
        </button>
        <Navigation collapsed={sidebarCollapsed} />
        <Button className="sidebar-logout" variant="ghost" aria-label={sidebarCollapsed ? 'Выйти' : undefined} onClick={() => void handleLogout()}>
          <LogOut size={18} aria-hidden="true" />
          <span>Выйти</span>
        </Button>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-menu-button"
            aria-label="Открыть меню"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div>
            <span className="topbar__title">Панель администратора</span>
            <span className="topbar__subtitle">Управление конфигурацией игры</span>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>

      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} title="Меню">
        <div className="drawer-brand">
          <span className="app-mark" aria-hidden="true">ВШ</span>
          <strong>Воздушный Шар</strong>
        </div>
        <Navigation onNavigate={() => setMobileMenuOpen(false)} />
        <Button variant="ghost" onClick={() => void handleLogout()}>
          <LogOut size={18} aria-hidden="true" />
          Выйти
        </Button>
      </Drawer>
    </div>
  );
}
