import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';

// Commodity palette — connects the splash to the product's data vocabulary
const ORBS: Array<{
  w: number; h: number; color: string;
  top?: string; bottom?: string; left?: string; right?: string;
}> = [
  { w: 340, h: 340, top: '-110px',  left: '-90px',  color: '#9b6dff' },
  { w: 280, h: 280, top: '-60px',   right: '-80px', color: '#4a90d9' },
  { w: 220, h: 220, bottom: '8%',   right: '-50px', color: '#e05a6a' },
  { w: 200, h: 200, bottom: '-60px',left: '0%',     color: '#38b2ac' },
];

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') handleTap(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exiting, isLoading]);

  const handleTap = () => {
    if (exiting || isLoading) return;
    setExiting(true);
    setTimeout(() => navigate(user ? '/' : '/login', { replace: true }), 380);
  };

  return (
    <div
      onClick={handleTap}
      style={{
        width: '100%', height: '100%',
        background: '#f7f8fb',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.38s ease',
      }}
    >
      {/* Static orbs */}
      {ORBS.map((o, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: o.w, height: o.h,
          borderRadius: '50%',
          background: o.color,
          filter: 'blur(80px)',
          opacity: 0.13,
          top: o.top, bottom: o.bottom,
          left: o.left, right: o.right,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Main content */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.08s',
        zIndex: 1, textAlign: 'center', padding: '0 40px',
      }}>
        {/* Subtitle */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '9px', fontWeight: 500,
          letterSpacing: '0.22em',
          color: '#2d3142', opacity: 0.38,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          Trading Operations
        </div>

        {/* Title */}
        <h1 style={{
          margin: 0, padding: 0,
          fontFamily: 'var(--font-display)',
          fontSize: '22px', fontWeight: 300,
          lineHeight: 1.5, letterSpacing: '0.04em',
          color: '#2d3142',
        }}>
          Agro Muda Anugerah
        </h1>

        {/* Version pill */}
        <div style={{
          marginTop: 20,
          display: 'inline-flex', alignItems: 'center',
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(180,180,210,0.35)',
          borderRadius: '20px', padding: '5px 14px',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px', fontWeight: 500,
            letterSpacing: '0.08em',
            color: '#2d3142', opacity: 0.45,
          }}>
            v1.0.0
          </span>
        </div>
      </div>

      {/* Tap to continue */}
      <div style={{
        position: 'absolute', bottom: 44,
        display: 'flex', alignItems: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
        zIndex: 1,
      }}>
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '9px', letterSpacing: '0.22em', fontWeight: 500,
          color: '#2d3142', opacity: 0.3,
          textTransform: 'uppercase',
          animation: 'hint-pulse 2.8s ease-in-out infinite',
        }}>
          {isLoading ? 'LOADING' : 'TAP TO CONTINUE'}
        </span>
      </div>

      {/* Copyright */}
      <div style={{
        position: 'absolute', bottom: 14, zIndex: 1,
        opacity: visible ? 0.2 : 0,
        transition: 'opacity 0.5s ease 0.7s',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '9px', letterSpacing: '0.04em', color: '#2d3142',
        }}>
          © 2026 CV. Agro Muda Anugerah
        </span>
      </div>

      <style>{`
        @keyframes hint-pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
