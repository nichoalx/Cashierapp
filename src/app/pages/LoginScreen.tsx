import { useState, useEffect } from 'react';
import { tap } from '../../utils/haptics';
import { useNavigate } from 'react-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAuth } from '../AuthContext';
import { ButtonSpinner } from '../components/Loader';
import { Mail, Lock, ArrowRight, Eye, EyeOff, KeyRound, ChevronLeft, Hash } from 'lucide-react';

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

type Mode = 'login' | 'reset-request' | 'reset-verify';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) navigate('/', { replace: true });
  }, [user, isLoading, navigate]);

  // ── Login state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(false);
  const [submitPressed, setSubmitPressed] = useState(false);

  // ── Reset state ──
  const [mode, setMode] = useState<Mode>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const isSubmitting = loading || waitingForSession;

  const goToReset = () => {
    setResetEmail(email);
    setResetCode('');
    setResetNewPw('');
    setResetError('');
    setResetSuccess(false);
    setMode('reset-request');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting) return;
    setError('');
    setLoading(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signIn',
      });
      localStorage.setItem('ama_last_login', new Date().toISOString());
      setWaitingForSession(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('Unauthorized') || msg.includes('not found')
          ? 'Email tidak terdaftar.'
          : 'Email atau kata sandi salah.'
      );
      setWaitingForSession(false);
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || resetLoading) return;
    setResetError('');
    setResetLoading(true);
    try {
      await signIn('password', { email: resetEmail.trim().toLowerCase(), flow: 'reset' });
      setMode('reset-verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setResetError(msg.includes('not found') ? 'Email tidak terdaftar.' : 'Gagal mengirim kode. Coba lagi.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !resetNewPw || resetLoading) return;
    if (resetNewPw.length < 8) { setResetError('Kata sandi minimal 8 karakter.'); return; }
    setResetError('');
    setResetLoading(true);
    try {
      await signIn('password', {
        email: resetEmail.trim().toLowerCase(),
        code: resetCode.trim(),
        newPassword: resetNewPw,
        flow: 'reset-verification',
      });
      setResetSuccess(true);
      setTimeout(() => { setMode('login'); setResetSuccess(false); }, 2200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setResetError(msg.includes('invalid') || msg.includes('code') ? 'Kode salah atau sudah kedaluwarsa.' : 'Gagal reset. Coba lagi.');
    } finally {
      setResetLoading(false);
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

        {/* ── Login ── */}
        {mode === 'login' && (
          <>
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
                  type="email" placeholder="Email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  autoComplete="email" autoFocus required style={inputStyle()}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type={showPw ? 'text' : 'password'} placeholder="Kata sandi" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password" required
                  style={{ ...inputStyle(), paddingRight: 44 }}
                />
                <button type="button" onPointerDown={e => e.preventDefault()} onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={goToReset}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontSize: '11px', fontWeight: 600, color: '#9a9db5' }}>
                  Lupa kata sandi?
                </button>
              </div>

              {error && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#be123c' }}>{error}</span>
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                onPointerDown={() => { tap(); setSubmitPressed(true); }}
                onPointerUp={() => setSubmitPressed(false)}
                onPointerLeave={() => setSubmitPressed(false)}
                style={{
                  height: 52, borderRadius: '14px', border: 'none',
                  cursor: isSubmitting ? 'default' : 'pointer',
                  background: isSubmitting ? '#a8acbe' : '#4a90d9',
                  color: '#fff', fontWeight: 700, fontSize: '14px',
                  boxShadow: submitPressed && !isSubmitting ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                  transform: submitPressed && !isSubmitting ? 'scale(0.97)' : 'scale(1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'box-shadow 0.07s, transform 0.07s, background-color 0.15s',
                  marginTop: 4, opacity: isSubmitting ? 0.7 : 1,
                }}>
                {isSubmitting ? <ButtonSpinner /> : <><span>Masuk</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}

        {/* ── Reset — step 1: request code ── */}
        {mode === 'reset-request' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <button type="button" onClick={() => setMode('login')}
                style={{ background: '#eef0f5', boxShadow: SHD_RAISED_STD, border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <ChevronLeft size={16} color="#9a9db5" />
              </button>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 3 }}>LUPA KATA SANDI</div>
                <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>Reset Kata Sandi</h3>
              </div>
            </div>

            <form onSubmit={handleResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#9a9db5', lineHeight: 1.6 }}>
                Masukkan email akun kamu. Kami akan mengirimkan kode verifikasi.
              </p>

              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email" placeholder="Email" value={resetEmail} autoFocus required
                  onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                  autoComplete="email" style={inputStyle()}
                />
              </div>

              {resetError && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#be123c' }}>{resetError}</span>
                </div>
              )}

              <button type="submit" disabled={resetLoading}
                style={{
                  height: 52, borderRadius: '14px', border: 'none',
                  cursor: resetLoading ? 'default' : 'pointer',
                  background: resetLoading ? '#a8acbe' : '#4a90d9',
                  color: '#fff', fontWeight: 700, fontSize: '14px',
                  boxShadow: SHD_ACTION_RAISED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background-color 0.15s', marginTop: 4,
                  opacity: resetLoading ? 0.7 : 1,
                }}>
                {resetLoading ? <ButtonSpinner /> : <><KeyRound size={15} /><span>Kirim Kode</span></>}
              </button>
            </form>
          </>
        )}

        {/* ── Reset — step 2: verify code + new password ── */}
        {mode === 'reset-verify' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <button type="button" onClick={() => { setMode('reset-request'); setResetError(''); }}
                style={{ background: '#eef0f5', boxShadow: SHD_RAISED_STD, border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <ChevronLeft size={16} color="#9a9db5" />
              </button>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 3 }}>VERIFIKASI</div>
                <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>Kode & Sandi Baru</h3>
              </div>
            </div>

            <form onSubmit={handleResetVerify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#9a9db5', lineHeight: 1.6 }}>
                Kode dikirim ke <strong style={{ color: '#2d3142' }}>{resetEmail}</strong>. Masukkan kode dan kata sandi baru kamu.
              </p>

              <div style={{ position: 'relative' }}>
                <Hash size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text" placeholder="Kode verifikasi" value={resetCode} autoFocus required
                  onChange={e => { setResetCode(e.target.value); setResetError(''); }}
                  autoComplete="one-time-code"
                  style={{ ...inputStyle(), letterSpacing: '0.1em' }}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type={showResetPw ? 'text' : 'password'} placeholder="Kata sandi baru (min. 8 karakter)"
                  value={resetNewPw} required
                  onChange={e => { setResetNewPw(e.target.value); setResetError(''); }}
                  autoComplete="new-password"
                  style={{ ...inputStyle(), paddingRight: 44 }}
                />
                <button type="button" onPointerDown={e => e.preventDefault()} onClick={() => setShowResetPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5', display: 'flex', alignItems: 'center' }}>
                  {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {resetError && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#be123c' }}>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>Kata sandi berhasil direset. Mengalihkan...</span>
                </div>
              )}

              <button type="submit" disabled={resetLoading || resetSuccess}
                style={{
                  height: 52, borderRadius: '14px', border: 'none',
                  cursor: resetLoading || resetSuccess ? 'default' : 'pointer',
                  background: resetSuccess ? '#52b96a' : resetLoading ? '#a8acbe' : '#4a90d9',
                  color: '#fff', fontWeight: 700, fontSize: '14px',
                  boxShadow: SHD_ACTION_RAISED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background-color 0.15s', marginTop: 4,
                  opacity: resetLoading ? 0.7 : 1,
                }}>
                {resetLoading ? <ButtonSpinner /> : <><span>Reset Kata Sandi</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
