import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAuth } from '../AuthContext';
import { ButtonSpinner } from '../components/Loader';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

const SHD_RECESSED      = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_RAISED_STD    = '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';
const SHD_ACTION_PRESS  = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)';

const ORBS: Array<{
  w: number; h: number; color: string;
  top?: string; bottom?: string; left?: string; right?: string;
}> = [
  { w: 340, h: 340, top: '-110px',  left: '-90px',  color: '#9b6dff' },
  { w: 280, h: 280, top: '-60px',   right: '-80px', color: '#4a90d9' },
  { w: 220, h: 220, bottom: '8%',   right: '-50px', color: '#e05a6a' },
  { w: 200, h: 200, bottom: '-60px',left: '0%',     color: '#38b2ac' },
];

const inputStyle = (hasIcon = true): React.CSSProperties => ({
  background: '#eef0f5',
  boxShadow: SHD_RECESSED,
  borderRadius: '12px',
  border: 'none',
  outline: 'none',
  padding: hasIcon ? '13px 14px 13px 42px' : '13px 14px',
  fontSize: '14px',
  color: '#2d3142',
  width: '100%',
  boxSizing: 'border-box',
});

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) navigate('/', { replace: true });
  }, [user, isLoading]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitPressed, setSubmitPressed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signIn',
      });
      localStorage.setItem('ama_last_login', new Date().toISOString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('Unauthorized') || msg.includes('not found')
          ? 'Email tidak terdaftar.'
          : 'Email atau kata sandi salah.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f7f8fb',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      position: 'relative', overflow: 'hidden',
    }}>
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

      <div style={{
        position: 'absolute',
        top: '16%', left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 1, whiteSpace: 'nowrap',
      }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '9px', fontWeight: 500,
          letterSpacing: '0.22em',
          color: '#2d3142', opacity: 0.38,
          textTransform: 'uppercase', marginBottom: 12,
        }}>
          Trading Operations
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px', fontWeight: 300,
          lineHeight: 1.5, letterSpacing: '0.04em',
          color: '#2d3142',
        }}>
          Agro Muda Anugerah
        </div>
      </div>

      <div style={{
        width: '100%', background: '#eef0f5',
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px 40px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.07)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>
            SELAMAT DATANG
          </div>
          <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>
            Masuk ke Akun
          </h3>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Mail size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              autoFocus
              required
              style={inputStyle()}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Kata sandi"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
              required
              style={{ ...inputStyle(), paddingRight: 44 }}
            />
            <button
              type="button"
              onPointerDown={e => e.preventDefault()}
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, color: '#9a9db5', display: 'flex', alignItems: 'center',
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 12px' }}>
              <span style={{ fontSize: '12px', color: '#be123c' }}>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            onPointerDown={() => setSubmitPressed(true)}
            onPointerUp={() => setSubmitPressed(false)}
            onPointerLeave={() => setSubmitPressed(false)}
            style={{
              height: 52, borderRadius: '14px', border: 'none',
              cursor: loading ? 'default' : 'pointer',
              background: loading ? '#a8acbe' : '#4a90d9',
              color: '#fff', fontWeight: 700, fontSize: '14px',
              boxShadow: submitPressed && !loading ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
              transform: submitPressed && !loading ? 'scale(0.97)' : 'scale(1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow 0.07s, transform 0.07s, background-color 0.15s',
              marginTop: 4,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <ButtonSpinner /> : <><span>Masuk</span><ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
