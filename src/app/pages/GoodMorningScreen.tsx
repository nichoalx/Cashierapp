import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatRupiah } from '../store';
import { PriceEditorModal } from '../components/PriceEditorModal';

const ORBS: Array<{ w: number; h: number; color: string; top?: string; bottom?: string; left?: string; right?: string }> = [
  { w: 340, h: 340, top: '-110px',   left: '-90px',  color: '#9b6dff' },
  { w: 280, h: 280, top: '-60px',    right: '-80px', color: '#4a90d9' },
  { w: 220, h: 220, bottom: '8%',    right: '-50px', color: '#e05a6a' },
  { w: 200, h: 200, bottom: '-60px', left: '0%',     color: '#38b2ac' },
];

const STORAGE_KEY = 'ama_welcome_date';
const BASE = 600;
const STEP = 100;

function todayJakarta() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export default function GoodMorningScreen() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const rawProducts = useQuery(api.products.listWithPrices);

  const [visible,    setVisible]    = useState(false);
  const [exiting,    setExiting]    = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const exitRef = useRef(false);

  // Mark today as seen so splash skips this screen next open
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, todayJakarta());
  }, []);

  useEffect(() => {
    if (!isLoading && !user) navigate('/login', { replace: true });
  }, [isLoading, user, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleContinue = useCallback(() => {
    if (exitRef.current || showEditor) return;
    exitRef.current = true;
    setExiting(true);
    setTimeout(() => navigate('/', { replace: true }), 650);
  }, [navigate, showEditor]);

  // Price data
  const kgProducts = useMemo(() =>
    (rawProducts ?? []).filter(p => p.unit === 'kg' && p.name !== 'E'),
  [rawProducts]);

  const plasticProduct = useMemo(() =>
    (rawProducts ?? []).find(p => p.variants.length > 0),
  [rawProducts]);

  const plasticPrice = useMemo(() => {
    if (!plasticProduct) return 0;
    const sorted = [...plasticProduct.variants].sort((a, b) => {
      const parse = (s: string) => s.split(/[×x]/).map(Number);
      const [a1, a2] = parse(a.variantValue), [b1, b2] = parse(b.variantValue);
      return a1 !== b1 ? a1 - b1 : a2 - b2;
    });
    return sorted[0]?.price ?? plasticProduct.price;
  }, [plasticProduct]);

  const pcsProducts = useMemo(() =>
    (rawProducts ?? []).filter(p => p.unit === 'pcs' && p.variants.length === 0),
  [rawProducts]);

  // Sequential animation delays
  let di = 0;
  const next = () => BASE + di++ * STEP;
  const kgD  = kgProducts.map(() => next());
  const pD   = plasticProduct ? next() : -1;
  const pcsD = pcsProducts.map(() => next());
  const btnD = BASE + di * STEP + 200;

  const row = (delay: number): React.CSSProperties => ({
    opacity: 0,
    animation: `row-in 420ms ease ${delay}ms both`,
  });

  return (
    <>
      {showEditor && <PriceEditorModal onClose={() => setShowEditor(false)} />}

      <div
        onClick={handleContinue}
        style={{
          width: '100%', height: '100%',
          background: '#f7f8fb',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          cursor: 'pointer',
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'scale(0.96)' : 'scale(1)',
          transition: 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Orbs */}
        {ORBS.map((o, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: o.w, height: o.h, borderRadius: '50%',
            background: o.color, filter: 'blur(80px)', opacity: 0.13,
            top: o.top, bottom: o.bottom, left: o.left, right: o.right,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Center content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: '100%', maxWidth: 320, padding: '0 24px',
          gap: 16, zIndex: 1,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.08s',
        }}>

          {/* Greeting */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 500,
              letterSpacing: '0.22em', color: '#2d3142', opacity: 0.38,
              textTransform: 'uppercase', marginBottom: 10,
            }}>
              Harga Hari Ini
            </div>
            <h2 style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: '22px', fontWeight: 300,
              lineHeight: 1.3, letterSpacing: '0.04em', color: '#2d3142',
            }}>
              Selamat Pagi
            </h2>
          </div>

          {/* Price card */}
          <div style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '16px',
            padding: '12px 14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            {/* Card header */}
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '8px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>DAFTAR HARGA</span>
            </div>

            {rawProducts == null ? (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '11px', color: '#c0c4d0' }}>
                Memuat...
              </div>
            ) : (
              <>
                {kgProducts.map((p, i) => (
                  <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, ...row(kgD[i]) }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2d3142', minWidth: 28 }}>{p.name}</span>
                    <span style={{ fontSize: '11px', color: '#9a9db5', flex: 1 }}>{p.fullName}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#4a4e69' }}>{formatRupiah(p.price)}/kg</span>
                  </div>
                ))}

                {plasticProduct && pD >= 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, ...row(pD) }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#38b2ac', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2d3142', minWidth: 28 }}>P</span>
                    <span style={{ fontSize: '11px', color: '#9a9db5', flex: 1 }}>Plastik</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#4a4e69' }}>{formatRupiah(plasticPrice)}/pcs</span>
                  </div>
                )}

                {pcsProducts.map((p, i) => (
                  <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, ...row(pcsD[i]) }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2d3142', minWidth: 28 }}>{p.name}</span>
                    <span style={{ fontSize: '11px', color: '#9a9db5', flex: 1 }}>{p.fullName}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#4a4e69' }}>{formatRupiah(p.price)}/pcs</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Edit pill — glass, below the card */}
          {rawProducts != null && (
            <button
              onClick={e => { e.stopPropagation(); setShowEditor(true); }}
              style={{
                ...row(btnD),
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                borderRadius: '20px', padding: '6px 20px',
                fontSize: '11px', color: '#4a90d9', fontWeight: 600,
                cursor: 'pointer', letterSpacing: '0.02em',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              }}
            >
              Edit?
            </button>
          )}

        </div>

        {/* Bottom hint */}
        <div style={{
          position: 'absolute', bottom: 44, zIndex: 1,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.5s',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '9px',
            letterSpacing: '0.22em', fontWeight: 500,
            color: '#2d3142', opacity: 0.3,
            textTransform: 'uppercase',
            animation: 'hint-pulse 2.8s ease-in-out infinite',
          }}>
            KETUK UNTUK MULAI
          </span>
        </div>

        {/* Copyright */}
        <div style={{
          position: 'absolute', bottom: 14, zIndex: 1,
          opacity: visible ? 0.2 : 0,
          transition: 'opacity 0.5s ease 0.7s',
          pointerEvents: 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '0.04em', color: '#2d3142' }}>
            © 2026 CV. Agro Muda Anugerah
          </span>
        </div>

        <style>{`
          @keyframes hint-pulse {
            0%, 100% { opacity: 0.3; }
            50%       { opacity: 0.6; }
          }
          @keyframes row-in {
            from { opacity: 0; transform: translateY(5px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </>
  );
}
