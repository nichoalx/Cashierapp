import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'), 2600);
    const t3 = setTimeout(() => {
      navigate(user ? '/' : '/login', { replace: true });
    }, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate, user]);

  const visible = phase === 'hold';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(160deg, #0a2010 0%, #0f3d1e 30%, #1a6b3a 65%, #2ea854 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: -80, right: -80,
        width: 280, height: 280, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, left: -60,
        width: 220, height: 220, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div style={{
        position: 'absolute', top: '20%', left: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: 'rgba(46,168,84,0.08)',
      }} />

      {/* Leaf/grain decorative element */}
      <div style={{
        width: 72, height: 72,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.07)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.7)',
        transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transitionDelay: '0.05s',
        boxShadow: '0 0 40px rgba(46,168,84,0.25)',
      }}>
        <span style={{ fontSize: '32px' }}>🌿</span>
      </div>

      {/* Company name */}
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        transitionDelay: '0.12s',
        textAlign: 'center',
        padding: '0 32px',
      }}>
        <div style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom: 10,
          fontWeight: 500,
        }}>
          Trading Operations
        </div>
        <h1 style={{
          margin: 0,
          color: '#ffffff',
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          textShadow: '0 2px 20px rgba(0,0,0,0.3)',
        }}>
          Agro Muda<br />Anugerah
        </h1>
      </div>

      {/* Version + divider */}
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        transitionDelay: '0.3s',
        marginTop: 28,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          borderRadius: '20px',
          padding: '4px 14px',
          border: '1px solid rgba(255,255,255,0.18)',
        }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.06em' }}>
            v1.0.0
          </span>
        </div>
      </div>

      {/* Loading dots */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        display: 'flex',
        gap: 6,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        transitionDelay: '0.5s',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(255,255,255,0.5)',
            animation: 'dot-pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>

      {/* Copyright */}
      <div style={{
        position: 'absolute',
        bottom: 32,
        textAlign: 'center',
        opacity: visible ? 0.35 : 0,
        transition: 'opacity 0.5s ease',
        transitionDelay: '0.6s',
      }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#fff', letterSpacing: '0.04em' }}>
          © 2026 CV. Agro Muda Anugerah. All rights reserved.
        </p>
      </div>

      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
