import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ShoppingCart, ClipboardList, Package, UserCircle } from 'lucide-react';

const tabs = [
  { path: '/', icon: ShoppingCart, label: 'Transaksi' },
  { path: '/log', icon: ClipboardList, label: 'Riwayat' },
  { path: '/stock', icon: Package, label: 'Stok' },
  { path: '/profile', icon: UserCircle, label: 'Akun' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      background: '#eef0f5',
      boxShadow: '-4px -4px 12px #ffffff, 4px 0px 12px #c8cad1',
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px',
      height: 64,
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
              gap: 4,
              padding: '8px 2px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#eef0f5',
              boxShadow: isActive
                ? 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff'
                : '4px 4px 8px #c8cad1, -4px -4px 8px #ffffff',
              transition: 'box-shadow 0.2s',
            }}>
              <Icon
                size={19}
                color={isActive ? '#4a90d9' : '#9a9db5'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
            </div>
            <span style={{
              fontSize: '9px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#4a90d9' : '#9a9db5',
              letterSpacing: '0.04em',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
