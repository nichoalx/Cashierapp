import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { LogOut, Shield, Clock, ChevronRight, Info, Key } from 'lucide-react';
import { useAppStore, formatRupiah } from '../store';

const ROLE_COLOR: Record<string, string> = {
  Admin: '#e05a6a',
  Manager: '#4a90d9',
  Operator: '#52b96a',
};

const ROLE_BG: Record<string, string> = {
  Admin: '#fff1f2',
  Manager: '#eff6ff',
  Operator: '#f0fdf4',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export default function UserScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { transactions } = useAppStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const totalTx = transactions.length;
  const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
  const roleColor = ROLE_COLOR[user.role] ?? '#9a9db5';
  const roleBg = ROLE_BG[user.role] ?? '#f5f5f5';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const neuCard: React.CSSProperties = {
    background: '#eef0f5',
    boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff',
    borderRadius: '16px',
  };

  const neuRow: React.CSSProperties = {
    background: '#eef0f5',
    boxShadow: '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
    borderRadius: '13px',
    padding: '13px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.08em' }}>AKUN</div>
        <h2 style={{ margin: '2px 0 0', color: '#2d3142' }}>Profil</h2>
      </div>

      {/* Avatar card */}
      <div style={{ ...neuCard, padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Avatar */}
        <div style={{
          width: 64, height: 64, borderRadius: '20px', flexShrink: 0,
          background: `linear-gradient(135deg, ${roleColor}22, ${roleColor}44)`,
          border: `2px solid ${roleColor}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `4px 4px 10px ${roleColor}22, -4px -4px 10px #ffffff`,
        }}>
          <span style={{ fontSize: '24px', fontWeight: 800, color: roleColor }}>
            {initials(user.name)}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#2d3142', marginBottom: 4 }}>{user.name}</div>
          <div style={{ fontSize: '12px', color: '#9a9db5', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          <span style={{
            display: 'inline-block', fontSize: '10px', fontWeight: 700,
            color: roleColor, background: roleBg,
            borderRadius: '6px', padding: '3px 8px', letterSpacing: '0.06em',
          }}>
            {user.role}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...neuCard, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#b8bbd0', letterSpacing: '0.08em', marginBottom: 4 }}>TRANSAKSI</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#4a90d9' }}>{totalTx}</div>
          <div style={{ fontSize: '10px', color: '#9a9db5' }}>hari ini</div>
        </div>
        <div style={{ ...neuCard, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#b8bbd0', letterSpacing: '0.08em', marginBottom: 4 }}>PENDAPATAN</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#52b96a', marginTop: 4 }}>{formatRupiah(totalRevenue)}</div>
          <div style={{ fontSize: '10px', color: '#9a9db5' }}>total</div>
        </div>
      </div>

      {/* Session info */}
      <div style={{ ...neuCard, padding: '14px 16px' }}>
        <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>SESI</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '9px', background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={15} color="#9a9db5" />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5' }}>Terakhir masuk</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{formatDateTime(user.lastLogin)}</div>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={neuRow}>
          <div style={{ width: 34, height: 34, borderRadius: '10px', background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={15} color="#4a90d9" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>Keamanan</div>
            <div style={{ fontSize: '11px', color: '#9a9db5' }}>OTP aktif untuk setiap login</div>
          </div>
          <ChevronRight size={14} color="#c0c4d0" />
        </div>

        <div style={neuRow}>
          <div style={{ width: 34, height: 34, borderRadius: '10px', background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={15} color="#9b6dff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>Tentang Aplikasi</div>
            <div style={{ fontSize: '11px', color: '#9a9db5' }}>Trading Ops · v1.0.0 · © 2026 CV. AMA</div>
          </div>
          <ChevronRight size={14} color="#c0c4d0" />
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Logout */}
      {!showLogoutConfirm ? (
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            width: '100%', height: 52, borderRadius: '14px', border: 'none', cursor: 'pointer',
            background: '#eef0f5',
            boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            color: '#e05a6a', fontWeight: 700, fontSize: '14px',
            transition: 'all 0.15s',
            marginBottom: 8,
          }}
        >
          <LogOut size={18} /> Keluar
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          <div style={{ textAlign: 'center', fontSize: '13px', color: '#4a4e69', padding: '4px 0' }}>
            Yakin ingin keluar dari akun ini?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowLogoutConfirm(false)} style={{
              flex: 1, height: 48, borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: '#eef0f5', boxShadow: '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
              color: '#9a9db5', fontWeight: 700, fontSize: '13px',
            }}>
              Batal
            </button>
            <button onClick={handleLogout} style={{
              flex: 2, height: 48, borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: '#e05a6a',
              boxShadow: '4px 4px 10px rgba(224,90,106,0.4)',
              color: '#fff', fontWeight: 700, fontSize: '13px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <LogOut size={16} /> Ya, Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
