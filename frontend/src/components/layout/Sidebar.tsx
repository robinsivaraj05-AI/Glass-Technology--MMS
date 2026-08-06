import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wrench, AlertTriangle, ClipboardList, Package,
  Zap, BarChart3, Users, Settings, Shield, BookOpen, Database,
  TrendingUp, Calendar, Bell, ChevronRight,
  Cpu, FlaskConical, HardDrive, Activity, FileText, DollarSign,
  GraduationCap, Building, Gauge, Menu, X, Network, CalendarCheck,
  Briefcase, Truck, Fuel, ShoppingCart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string; icon?: React.ReactNode }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard',    icon: <LayoutDashboard size={16} />, path: '/dashboard' },
  {
    label: 'Maintenance',  icon: <Wrench size={16} />,
    children: [
      { label: 'Preventive PM',  path: '/pm',         icon: <Calendar size={14} /> },
      { label: 'Breakdown',      path: '/breakdowns',  icon: <AlertTriangle size={14} /> },
      { label: 'Work Orders',    path: '/work-orders', icon: <ClipboardList size={14} /> },
      { label: 'Predictive',     path: '/predictive',  icon: <Activity size={14} /> },
    ],
  },
  {
    label: 'Assets',       icon: <HardDrive size={16} />,
    children: [
      { label: 'Asset Management', path: '/assets',      icon: <Database size={14} /> },
      { label: 'Master Data',      path: '/machines',     icon: <Cpu size={14} /> },
      { label: 'Calibration',      path: '/calibration',  icon: <FlaskConical size={14} /> },
      { label: 'AMC Management',   path: '/amc',          icon: <FileText size={14} /> },
    ],
  },
  {
    label: 'Spare Parts',  icon: <Package size={16} />, path: '/spare-parts',
  },
  {
    label: 'Energy',       icon: <Zap size={16} />,
    children: [
      { label: 'Energy Dashboard', path: '/energy',         icon: <Gauge size={14} /> },
      { label: 'Utility Monitoring',path: '/utility',       icon: <Activity size={14} /> },
    ],
  },
  {
    label: 'Projects',     icon: <Building size={16} />, path: '/projects',
  },
  {
    label: 'Safety',       icon: <Shield size={16} />,
    children: [
      { label: 'Safety Module',  path: '/safety',     icon: <Shield size={14} /> },
      { label: 'Shutdown Plan',  path: '/shutdown',   icon: <Calendar size={14} /> },
    ],
  },
  {
    label: 'Employees',    icon: <Users size={16} />,
    children: [
      { label: 'Employee Profile', path: '/employees',           icon: <Users size={14} />         },
      { label: 'Attendance',     path: '/attendance',           icon: <CalendarCheck size={14} /> },
      { label: 'Org Chart',      path: '/org-chart',            icon: <Network size={14} />       },
      { label: 'E&I Team Summary', path: '/org-chart/summary',    icon: <BarChart3 size={14} />     },
      { label: 'Shift & Skills', path: '/manpower',             icon: <Calendar size={14} />      },
      { label: 'Training',       path: '/training',             icon: <GraduationCap size={14} /> },
    ],
  },
  {
    label: 'Outsource',    icon: <Briefcase size={16} />,
    children: [
      { label: 'Contract Master',  path: '/contractor/contracts', icon: <FileText size={14} /> },
      { label: 'Work Entry',       path: '/contractor/entry',     icon: <ClipboardList size={14} /> },
      { label: 'Cost Report',      path: '/contractor/report',    icon: <DollarSign size={14} /> },
    ],
  },
  {
    label: 'Rental Equip.',  icon: <Truck size={16} />,
    children: [
      { label: 'Equipment Master', path: '/rental/equipment',    icon: <Wrench size={14} /> },
      { label: 'Work Entry',       path: '/rental/entry',        icon: <ClipboardList size={14} /> },
      { label: 'Accessories',      path: '/rental/accessories',  icon: <Fuel size={14} /> },
      { label: 'Cost Report',      path: '/rental/report',       icon: <DollarSign size={14} /> },
    ],
  },
  {
    label: 'Purchase',     icon: <ShoppingCart size={16} />,
    children: [
      { label: 'RFQ Management',       path: '/purchase/rfq',      icon: <FileText size={14} /> },
      { label: 'PO Follow-up',         path: '/purchase/po',       icon: <ClipboardList size={14} /> },
      { label: 'E&I Purchase Status',  path: '/purchase/followup', icon: <BarChart3 size={14} /> },
      { label: 'Purchase Costing',     path: '/purchase/costing',  icon: <TrendingUp size={14} /> },
    ],
  },
  {
    label: 'Finance',      icon: <DollarSign size={16} />,
    children: [
      { label: 'Budget',          path: '/budget',                icon: <TrendingUp size={14} /> },
      { label: 'Vendors',         path: '/vendors',               icon: <Building size={14} /> },
      { label: 'E&I Costing',    path: '/finance/costing',        icon: <BarChart3 size={14} /> },
      { label: 'E&I PUR Report', path: '/finance/ei-pur-report',  icon: <FileText size={14} /> },
    ],
  },
  {
    label: 'ISO & Audit',  icon: <BookOpen size={16} />,
    children: [
      { label: 'ISO Documentation', path: '/iso',    icon: <FileText size={14} /> },
      { label: 'Quality Module',    path: '/quality', icon: <BarChart3 size={14} /> },
    ],
  },
  { label: 'Daily Logbook', icon: <BookOpen size={16} />, path: '/logbook' },
  { label: 'Reports',      icon: <BarChart3 size={16} />, path: '/reports' },
  { label: 'Notifications',icon: <Bell size={16} />,      path: '/notifications' },
  { label: 'Settings',     icon: <Settings size={16} />,  path: '/settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<string[]>(['Maintenance']);
  const location = useLocation();
  const { user } = useAuth();

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);
  };

  const isChildActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path));

  return (
    <aside
      style={{
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
        background: 'linear-gradient(180deg, #060610 0%, #0a0a18 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        zIndex: 40,
        overflowX: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: collapsed ? '14px 10px' : '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', minHeight: 64 }}>
        {collapsed ? (
          <img src="/logo-icon.svg" alt="Glass Technology" style={{ width: 34, height: 34, flexShrink: 0 }} />
        ) : (
          <img src="/logo-dark.svg" alt="Glass Technology" style={{ height: 34, width: 'auto', maxWidth: 150, flexShrink: 0 }} />
        )}
        <button
          onClick={onToggle}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, flexShrink: 0 }}
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* User quick info */}
      {!collapsed && user && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: 'white',
            }}>
              {user.name.split(' ').map(n => n[0]).join('').slice(0,2)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: '#60a5fa', textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => {
          if (item.path) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link sidebar-parent-btn ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
                style={{ justifyContent: collapsed ? 'center' : undefined }}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          }

          const isOpen = openGroups.includes(item.label);
          const hasActiveChild = isChildActive(item);

          return (
            <div key={item.label}>
              <button
                onClick={() => !collapsed && toggleGroup(item.label)}
                className={`sidebar-link sidebar-parent-btn ${hasActiveChild && !isOpen ? 'active' : ''}`}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  justifyContent: collapsed ? 'center' : undefined,
                  ...(hasActiveChild && !isOpen ? { background: 'rgba(59,130,246,0.08)', color: '#60a5fa' } : {}),
                }}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{ color: '#475569', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : '' }}>
                      <ChevronRight size={13} />
                    </span>
                  </>
                )}
              </button>
              {isOpen && !collapsed && item.children && (
                <div style={{ paddingLeft: 12, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {item.children.map(child => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      style={({ isActive }) => ({ fontSize: 12, padding: '7px 12px', color: isActive ? '#60a5fa' : '#6b7280' })}
                    >
                      {child.icon && <span style={{ flexShrink: 0 }}>{child.icon}</span>}
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Version */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 10, color: '#334155', textAlign: 'center' }}>
          MMS v2.0.0 — E&I Dept.
        </div>
      )}
    </aside>
  );
}
