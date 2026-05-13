import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ShoppingCart, ClipboardList, Package, UserCircle, Users } from 'lucide-react';

const SHD_RAISED_STD = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';

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
  const [pressedPath, setPressedPath] = useState<string | null>(null);

  const activeIndex = tabs.findIndex(t => t.path === location.pathname);

  return (
    <nav style={{
      position: 'absolute',
      bottom: 'var(--app-nav-safe-bottom)',
      left: 'var(--app-nav-gutter)',
      right: 'var(--app-nav-gutter)',
      zIndex: 10,
      background: '#eef0f5',
      boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
      borderRadius: '999px',
      height: 'var(--app-nav-height)',
    }}>
      {/* Inner container is the positioning context for the pill */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        padding: '0 8px',
      }}>
        {/* Sliding pill — uses calc() against the inner div width */}
        {activeIndex >= 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `calc(8px + ${activeIndex} * (100% - 16px) / 5 + 4px)`,
            width: 'calc((100% - 16px) / 5 - 8px)',
            height: 42,
            transform: 'translateY(-50%)',
            borderRadius: '999px',
            background: '#eef0f5',
            boxShadow: SHD_RAISED_STD,
            transition: 'left 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }} />
        )}

        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const isPressed = pressedPath === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              onPointerDown={() => setPressedPath(tab.path)}
              onPointerUp={() => setPressedPath(null)}
              onPointerLeave={() => setPressedPath(null)}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Icon
                size={18}
                color={isActive ? '#4a90d9' : '#9a9db5'}
                strokeWidth={isActive ? 2.5 : 1.8}
                style={{
                  transform: isPressed ? 'scale(0.82)' : 'scale(1)',
                  transition: 'transform 0.1s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'block',
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
