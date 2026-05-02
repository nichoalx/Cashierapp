import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ShoppingCart, ClipboardList, Package, UserCircle, Users } from 'lucide-react';

const tabs = [
  { path: '/',        icon: ShoppingCart, label: 'Transaksi' },
  { path: '/log',     icon: ClipboardList, label: 'Riwayat' },
  { path: '/stock',   icon: Package,      label: 'Stok' },
  { path: '/members', icon: Users,        label: 'Anggota' },
  { path: '/profile', icon: UserCircle,   label: 'Akun' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      background: '#eef0f5',
      boxShadow: '-2px -2px 10px rgba(255,255,255,0.8), 2px 0px 10px #c8cad1',
      display: 'flex',
      alignItems: 'center',
      padding: '0 2px',
      height: 62,
      flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '6px 1px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#eef0f5',
              boxShadow: isActive
                ? 'inset 3px 3px 6px #c8cad1, inset -2px -2px 6px rgba(255,255,255,0.9)'
                : '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.9)',
              transition: 'box-shadow 0.2s',
            }}>
              <Icon
                size={18}
                color={isActive ? '#4a90d9' : '#9a9db5'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
            </div>
            <span style={{
              fontSize: '8px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#4a90d9' : '#9a9db5',
              letterSpacing: '0.03em',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
