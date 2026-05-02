import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';

const ORBS = [
  { w: 220, h: 220, top: '-60px', left: '-60px',  color: '#c084fc', delay: '0s' },
  { w: 180, h: 180, top: '30%',   right: '-50px',  color: '#38bdf8', delay: '1.2s' },
  { w: 140, h: 140, bottom: '15%',left: '10%',     color: '#f472b6', delay: '0.6s' },
  { w: 100, h: 100, bottom: '-30px', right: '20%', color: '#4ade80', delay: '2s' },
  { w: 80,  h: 80,  top: '55%',   left: '5%',      color: '#fbbf24', delay: '1.8s' },
];

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleTap = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => navigate(user ? '/' : '/login', { replace: true }), 500);
  };

  return (
    <div
      onClick={handleTap}
      style={{
        width: '100%', height: '100%',
        background: '#07080f',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.45s ease',
      }}
    >
      {/* Ambient blobs */}
      {ORBS.map((o, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: o.w, height: o.h,
          borderRadius: '50%',
          background: o.color,
          filter: 'blur(55px)',
          opacity: visible ? 0.22 : 0,
          transition: `opacity 1.2s ease ${o.delay}`,
          ...(o.top    ? { top: o.top }       : {}),
          ...(o.bottom ? { bottom: o.bottom } : {}),
          ...(o.left   ? { left: o.left }     : {}),
          ...(o.right  ? { right: o.right }   : {}),
        }} />
      ))}

      {/* Grain texture overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.4,
      }} />

      {/* Thin grid lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Main content */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity 0.8s ease 0.15s, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s',
        zIndex: 1, textAlign: 'center', padding: '0 32px',
      }}>
        {/* Shimmer tag */}
        <div style={{
          fontSize: '9px', letterSpacing: '0.28em', fontWeight: 600,
          color: 'rgba(255,255,255,0.35)', marginBottom: 20,
          textTransform: 'uppercase',
        }}>
          Trading Operations
        </div>

        {/* Main holographic title */}
        <h1 style={{
          margin: 0, padding: 0,
          fontSize: '36px', fontWeight: 900,
          lineHeight: 1.15, letterSpacing: '-0.02em',
          background: 'linear-gradient(90deg, #ff9eb5, #c084fc, #60a5fa, #34d399, #fbbf24, #f87171, #c084fc, #60a5fa, #ff9eb5)',
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'holo-drift 5s linear infinite',
        }}>
          Agro Muda<br />Anugerah
        </h1>

        {/* Version pill */}
        <div style={{
          marginTop: 18,
          display: 'inline-flex', alignItems: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px', padding: '4px 14px',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
            background: 'linear-gradient(90deg, #c084fc, #60a5fa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            v1.0.0
          </span>
        </div>
      </div>

      {/* Tap to continue */}
      <div style={{
        position: 'absolute', bottom: 52,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease 0.7s',
        zIndex: 1,
      }}>
        {/* Animated chevrons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 4 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              width: 8, height: 8,
              borderRight: '1.5px solid rgba(255,255,255,0.25)',
              borderBottom: '1.5px solid rgba(255,255,255,0.25)',
              transform: 'rotate(45deg)',
              animation: 'chevron-bob 1.8s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }} />
          ))}
        </div>
        <span style={{
          fontSize: '11px', letterSpacing: '0.18em', fontWeight: 500,
          color: 'rgba(255,255,255,0.3)',
          animation: 'hint-pulse 2.5s ease-in-out infinite',
        }}>
          TAP TO CONTINUE
        </span>
      </div>

      {/* Copyright */}
      <div style={{
        position: 'absolute', bottom: 14, zIndex: 1,
        opacity: visible ? 0.2 : 0,
        transition: 'opacity 0.6s ease 0.9s',
      }}>
        <span style={{ fontSize: '9px', color: '#fff', letterSpacing: '0.04em' }}>
          © 2026 CV. Agro Muda Anugerah. All rights reserved.
        </span>
      </div>

      <style>{`
        @keyframes holo-drift {
          0%   { background-position: 0%   50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes hint-pulse {
          0%, 100% { opacity: 0.25; }
          50%       { opacity: 0.75; }
        }
        @keyframes chevron-bob {
          0%, 100% { transform: rotate(45deg) translateY(0); opacity: 0.2; }
          50%       { transform: rotate(45deg) translateY(3px); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
