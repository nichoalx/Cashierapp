import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { Mail, ArrowRight, RefreshCw } from 'lucide-react';

const SHD_RECESSED     = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_RAISED_STD   = '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff';
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

export default function LoginScreen() {
  const navigate = useNavigate();
  const { requestOtp, verifyOtp, pendingOtp, pendingEmail } = useAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitPressed, setSubmitPressed] = useState(false);

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [verifyPressed, setVerifyPressed] = useState(false);

  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendTimer]);

  const handleEmailSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    setEmailError('');
    const result = requestOtp(email.trim());
    if (!result.success) {
      setEmailError(result.error ?? 'Gagal mengirim OTP.');
      return;
    }
    setStep('otp');
    setResendTimer(30);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[index] = val.slice(-1);
    setOtp(next);
    if (val && index < 5) otpRefs.current[index + 1]?.focus();
    if (val && next.every(d => d !== '') && index === 5) submitOtp(next.join(''));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const submitOtp = (code: string) => {
    setOtpError('');
    if (verifyOtp(code)) {
      navigate('/', { replace: true });
    } else {
      setOtpShake(true);
      setOtpError('Kode salah. Coba lagi.');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => { setOtpShake(false); otpRefs.current[0]?.focus(); }, 600);
    }
  };

  const handleResend = () => {
    if (resendTimer > 0 || !pendingEmail) return;
    requestOtp(pendingEmail);
    setResendTimer(30);
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
  };

  const otpComplete = otp.every(d => d !== '');

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f7f8fb',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      position: 'relative', overflow: 'hidden',
    }}>
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

      {/* Brand wordmark */}
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

      {/* Sheet */}
      <div style={{
        width: '100%', background: '#eef0f5',
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px 40px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.07)',
        position: 'relative', zIndex: 1,
      }}>

        {step === 'email' ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>SELAMAT DATANG</div>
              <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>Masuk ke Akun</h3>
            </div>

            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email"
                  placeholder="admin@agromuda.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                  autoFocus
                  required
                  style={{
                    background: '#eef0f5',
                    boxShadow: SHD_RECESSED,
                    borderRadius: '12px', border: 'none', outline: 'none',
                    padding: '13px 14px 13px 42px',
                    fontSize: '14px', color: '#2d3142',
                    width: '100%', boxSizing: 'border-box',
                  }}
                />
              </div>

              {emailError && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#be123c' }}>{emailError}</span>
                </div>
              )}

              <button
                type="submit"
                onPointerDown={() => setSubmitPressed(true)}
                onPointerUp={() => setSubmitPressed(false)}
                onPointerLeave={() => setSubmitPressed(false)}
                style={{
                  height: 52, borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: '#4a90d9', color: '#fff',
                  fontWeight: 700, fontSize: '14px',
                  boxShadow: submitPressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                  transform: submitPressed ? 'scale(0.97)' : 'scale(1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'box-shadow 0.07s, transform 0.07s',
                  marginTop: 4,
                }}
              >
                Kirim OTP <ArrowRight size={16} />
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <button
                onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setOtpError(''); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9a9db5', padding: 0, marginBottom: 12 }}
              >
                ← Kembali
              </button>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }}>VERIFIKASI</div>
              <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>Masukkan Kode OTP</h3>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9a9db5' }}>
                Kode 6 digit dikirim ke <strong style={{ color: '#4a90d9' }}>{pendingEmail}</strong>
              </p>
            </div>

            {/* Dev hint */}
            {pendingOtp && (
              <div style={{
                background: '#eef0f5', boxShadow: SHD_RAISED_STD,
                borderRadius: '12px', padding: '10px 14px', marginBottom: 18,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>DEV</div>
                <div style={{ fontSize: '18px', fontWeight: 500, color: '#4a90d9', letterSpacing: '0.14em', fontFamily: 'var(--font-mono)' }}>
                  {pendingOtp}
                </div>
              </div>
            )}

            {/* OTP grid — 6 digits */}
            <div style={{
              display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18,
              animation: otpShake ? 'otp-shake 0.5s ease' : 'none',
            }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                  style={{
                    width: 42, height: 52, textAlign: 'center',
                    fontSize: '22px', fontWeight: 700, color: '#2d3142',
                    background: '#eef0f5',
                    boxShadow: digit ? SHD_RECESSED : SHD_RAISED_STD,
                    borderRadius: '12px', border: 'none', outline: 'none',
                    transition: 'box-shadow 0.12s',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              ))}
            </div>

            {otpError && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '9px 12px', marginBottom: 14 }}>
                <span style={{ fontSize: '12px', color: '#be123c' }}>{otpError}</span>
              </div>
            )}

            <button
              onClick={() => submitOtp(otp.join(''))}
              disabled={!otpComplete}
              onPointerDown={() => setVerifyPressed(true)}
              onPointerUp={() => setVerifyPressed(false)}
              onPointerLeave={() => setVerifyPressed(false)}
              style={{
                width: '100%', height: 52, borderRadius: '14px', border: 'none',
                cursor: otpComplete ? 'pointer' : 'default',
                background: otpComplete ? '#4a90d9' : '#a8acbe',
                opacity: otpComplete ? 1 : 0.5,
                color: '#fff', fontWeight: 700, fontSize: '14px',
                boxShadow: !otpComplete ? 'none' : verifyPressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                transform: verifyPressed && otpComplete ? 'scale(0.97)' : 'scale(1)',
                transition: 'box-shadow 0.07s, transform 0.07s, opacity 0.15s',
              }}
            >
              Verifikasi &amp; Masuk
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={handleResend}
                disabled={resendTimer > 0}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: resendTimer > 0 ? 'default' : 'pointer',
                  fontSize: '12px', color: resendTimer > 0 ? '#b8bbd0' : '#4a90d9',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <RefreshCw size={11} />
                {resendTimer > 0 ? `Kirim ulang dalam ${resendTimer}s` : 'Kirim ulang OTP'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes otp-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
