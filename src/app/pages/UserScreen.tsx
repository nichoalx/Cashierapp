import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { ButtonSpinner } from '../components/Loader';
import { LogOut, Clock, Info, X } from 'lucide-react';

const SHD_RAISED_STD    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RAISED_STRONG = '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff';
const SHD_RECESSED      = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';
const SHD_ACTION_PRESS  = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)';
const MOTION_EASE       = 'cubic-bezier(0.16, 1, 0.3, 1)';

const ROLE_COLOR: Record<string, string> = {
  Admin:    '#e05a6a',
  Manager:  '#4a90d9',
  Operator: '#52b96a',
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

const ABOUT_ROWS: [string, string][] = [
  ['Aplikasi',   'Trading Ops — Kasir Kedelai'],
  ['Versi',      'v1.0.0'],
  ['Platform',   'Progressive Web App'],
  ['Hak Cipta',  '© 2026 CV. Agro Muda Anugerah'],
];

export default function UserScreen() {
  const { user, logout, isLoggingOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAbout, setShowAbout]                 = useState(false);
  const [logoutError, setLogoutError]             = useState('');
  const [logoutPressed, setLogoutPressed]         = useState(false);
  const [cancelPressed, setCancelPressed]         = useState(false);
  const [confirmPressed, setConfirmPressed]       = useState(false);
  const [aboutPressed, setAboutPressed]           = useState(false);

  const aboutRowRef   = useRef<HTMLDivElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpen  = useRef(false);

  useEffect(() => {
    if (showAbout) {
      sheetWasOpen.current = true;
      sheetCloseRef.current?.focus();
    } else if (sheetWasOpen.current) {
      sheetWasOpen.current = false;
      aboutRowRef.current?.focus();
    }
  }, [showAbout]);

  useEffect(() => {
    if (!showAbout) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAbout(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showAbout]);

  if (!user) return null;

  const roleColor = ROLE_COLOR[user.role] ?? '#9a9db5';

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError('Gagal keluar. Coba lagi.');
      setShowLogoutConfirm(false);
    }
  };

  const neuCard = {
    background: '#eef0f5',
    boxShadow: SHD_RAISED_STRONG,
    borderRadius: '16px',
  };

  const iconWell = {
    background: '#eef0f5',
    boxShadow: SHD_RECESSED,
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes logout-confirm-enter {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes logout-choice-enter {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheet-enter {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes backdrop-enter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
          @media (prefers-reduced-motion: reduce) {
          .logout-motion { animation: none !important; transition-duration: 0.01ms !important; }
          .sheet-motion  { animation: none !important; }
        }
        .about-row:focus-visible {
          box-shadow: 4px 4px 9px #c8cad1, -4px -4px 9px #ffffff, 0 0 0 2.5px #4a90d9 !important;
        }
      `}</style>

      {/* Scrollable content */}
      <div style={{
        flex: 1, minHeight: 0,
        overflow: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
        padding: '16px var(--app-page-gutter) 12px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Akun</div>
          <h2 style={{ margin: '2px 0 0', color: '#2d3142', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>Profil</h2>
        </div>

        {/* Avatar card */}
        <div style={{ ...neuCard, padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '20px', flexShrink: 0,
            background: `${roleColor}18`, boxShadow: SHD_RAISED_STD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: roleColor }}>
              {initials(user.name)}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#2d3142', marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: '12px', color: '#9a9db5', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            <span style={{
              display: 'inline-block', fontSize: '9px', fontWeight: 600,
              color: roleColor, background: `${roleColor}14`,
              borderRadius: '6px', padding: '3px 9px', letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {user.role}
            </span>
          </div>
        </div>

        {/* Session info */}
        <div style={{ ...neuCard, padding: '14px 16px' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Sesi</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...iconWell, width: 32, height: 32 }}>
              <Clock size={15} color="#9a9db5" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#9a9db5' }}>Terakhir masuk</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{formatDateTime(user.lastLogin)}</div>
            </div>
          </div>
        </div>

        {/* About row */}
        <div
          ref={aboutRowRef}
          role="button"
          tabIndex={0}
          className="about-row"
          onClick={() => setShowAbout(true)}
          onPointerDown={() => setAboutPressed(true)}
          onPointerUp={() => setAboutPressed(false)}
          onPointerLeave={() => setAboutPressed(false)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setShowAbout(true)}
          style={{
            background: '#eef0f5',
            boxShadow: aboutPressed ? SHD_RECESSED : SHD_RAISED_STD,
            borderRadius: '14px',
            padding: '13px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer',
            transform: aboutPressed ? 'translateY(1px) scale(0.99)' : 'translateY(0) scale(1)',
            transition: `box-shadow 80ms ${MOTION_EASE}, transform 80ms ${MOTION_EASE}`,
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
          }}
        >
          <div style={{ ...iconWell, width: 34, height: 34 }}>
            <Info size={15} color="#9a9db5" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>Tentang Aplikasi</div>
            <div style={{ fontSize: '11px', color: '#9a9db5' }}>Trading Ops · v1.0.0</div>
          </div>
        </div>
      </div>

      {/* Sticky logout — always visible above nav */}
      <div aria-live="polite" style={{ flexShrink: 0, padding: '8px var(--app-page-gutter)', paddingBottom: 'var(--app-content-bottom)' }}>
        {logoutError && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '8px 12px', marginBottom: 8 }}>
            <span style={{ fontSize: '12px', color: '#be123c' }}>{logoutError}</span>
          </div>
        )}

        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            onPointerDown={() => setLogoutPressed(true)}
            onPointerUp={() => setLogoutPressed(false)}
            onPointerLeave={() => setLogoutPressed(false)}
            style={{
              width: '100%', height: 52, borderRadius: '14px', border: 'none', cursor: 'pointer',
              background: '#eef0f5',
              boxShadow: logoutPressed ? SHD_ACTION_PRESS : SHD_RAISED_STRONG,
              transform: logoutPressed ? 'translateY(1px) scale(0.975)' : 'translateY(0) scale(1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              color: '#e05a6a', fontWeight: 700, fontSize: '14px',
              transition: `box-shadow 90ms ${MOTION_EASE}, transform 90ms ${MOTION_EASE}`,
              willChange: 'transform',
            }}
            className="logout-motion"
          >
            <LogOut size={18} style={{
              transform: logoutPressed ? 'translateX(-1px)' : 'translateX(0)',
              transition: `transform 90ms ${MOTION_EASE}`,
            }} />
            Keluar
          </button>
        ) : (
          <div
            className="logout-motion"
            style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              animation: `logout-confirm-enter 180ms ${MOTION_EASE} both`,
              transformOrigin: 'bottom center',
              willChange: 'transform, opacity',
            }}
          >
            <div
              className="logout-motion"
              style={{
                textAlign: 'center', fontSize: '13px', color: '#4a4e69', padding: '4px 0',
                animation: `logout-choice-enter 160ms ${MOTION_EASE} 30ms both`,
              }}
            >
              Yakin ingin keluar dari akun ini?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                onPointerDown={() => setCancelPressed(true)}
                onPointerUp={() => setCancelPressed(false)}
                onPointerLeave={() => setCancelPressed(false)}
                style={{
                  flex: 1, height: 48, borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: '#eef0f5',
                  boxShadow: cancelPressed ? SHD_RECESSED : SHD_RAISED_STD,
                  transform: cancelPressed ? 'translateY(1px) scale(0.98)' : 'translateY(0) scale(1)',
                  color: '#9a9db5', fontWeight: 700, fontSize: '13px',
                  transition: `box-shadow 90ms ${MOTION_EASE}, transform 90ms ${MOTION_EASE}`,
                  animation: `logout-choice-enter 160ms ${MOTION_EASE} 65ms both`,
                  willChange: 'transform',
                }}
                className="logout-motion"
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                onPointerDown={() => !isLoggingOut && setConfirmPressed(true)}
                onPointerUp={() => setConfirmPressed(false)}
                onPointerLeave={() => setConfirmPressed(false)}
                style={{
                  flex: 2, height: 48, borderRadius: '12px', border: 'none',
                  cursor: isLoggingOut ? 'default' : 'pointer',
                  background: '#e05a6a',
                  boxShadow: confirmPressed && !isLoggingOut ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                  transform: confirmPressed && !isLoggingOut ? 'translateY(1px) scale(0.975)' : 'translateY(0) scale(1)',
                  color: '#fef7f8', fontWeight: 700, fontSize: '13px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: `box-shadow 90ms ${MOTION_EASE}, transform 90ms ${MOTION_EASE}`,
                  animation: `logout-choice-enter 160ms ${MOTION_EASE} 95ms both`,
                  willChange: 'transform',
                  opacity: isLoggingOut ? 0.8 : 1,
                }}
                className="logout-motion"
              >
                {isLoggingOut
                  ? <ButtonSpinner />
                  : <>
                      <LogOut size={16} style={{
                        transform: confirmPressed ? 'translateX(-1px)' : 'translateX(0)',
                        transition: `transform 90ms ${MOTION_EASE}`,
                      }} />
                      Ya, Keluar
                    </>
                }
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About sheet */}
      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: `backdrop-enter 200ms ease both`,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(45,49,66,0.22)', backdropFilter: 'blur(2px)' }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-sheet-title"
            onClick={e => e.stopPropagation()}
            className="sheet-motion"
            style={{
              position: 'relative', zIndex: 1, width: '100%', maxWidth: 430,
              background: '#eef0f5',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.10)',
              padding: '0 24px',
              paddingBottom: 'var(--app-content-bottom)',
              animation: `sheet-enter 300ms ${MOTION_EASE} both`,
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#c8cad1' }} />
            </div>

            {/* Sheet header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20 }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Informasi</div>
                <div id="about-sheet-title" style={{ fontSize: '17px', fontWeight: 700, color: '#2d3142' }}>Tentang Aplikasi</div>
              </div>
              <button
                ref={sheetCloseRef}
                aria-label="Tutup"
                onClick={() => setShowAbout(false)}
                style={{
                  background: '#eef0f5', border: 'none', cursor: 'pointer',
                  width: 44, height: 44, borderRadius: '10px',
                  boxShadow: SHD_RAISED_STD,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9a9db5', flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
              {ABOUT_ROWS.map(([label, value], i) => (
                <div
                  key={label}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '11px 0',
                    borderBottom: i < ABOUT_ROWS.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#9a9db5', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: '#2d3142', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
