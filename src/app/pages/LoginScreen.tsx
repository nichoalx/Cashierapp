import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../AuthContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight, RefreshCw } from 'lucide-react';

const neuInput: React.CSSProperties = {
  background: '#eef0f5',
  boxShadow: 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff',
  borderRadius: '12px',
  border: 'none',
  outline: 'none',
  padding: '13px 14px 13px 42px',
  fontSize: '14px',
  color: '#2d3142',
  width: '100%',
  boxSizing: 'border-box' as const,
};

export default function LoginScreen() {
  const navigate = useNavigate();
  const { login, verifyOtp, pendingOtp, pendingEmail } = useAuth();

  // Step 1: credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [credError, setCredError] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  // Step 2: OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  // Resend countdown
  useEffect(() => {
    if (step !== 'otp') return;
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, resendTimer]);

  const handleCredSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    const result = login(email, password);
    if (!result.success) {
      setCredError(result.error || 'Login gagal.');
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
    if (val && index < 7) otpRefs.current[index + 1]?.focus();
    // Auto-submit if all filled
    if (val && next.every(d => d !== '') && index === 7) {
      submitOtp(next.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const submitOtp = (code: string) => {
    setOtpError('');
    const ok = verifyOtp(code);
    if (ok) {
      navigate('/', { replace: true });
    } else {
      setOtpShake(true);
      setOtpError('Kode OTP salah. Periksa kembali.');
      setOtp(['', '', '', '', '', '', '', '']);
      setTimeout(() => { setOtpShake(false); otpRefs.current[0]?.focus(); }, 600);
    }
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    login(email, password);
    setResendTimer(30);
    setOtp(['', '', '', '', '', '', '', '']);
    setOtpError('');
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #0a2010 0%, #0f3d1e 30%, #1a6b3a 65%, #2ea854 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-end',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background circles */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <span style={{ fontSize: '24px' }}>🌿</span>
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', marginBottom: 6 }}>TRADING OPERATIONS</div>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 800 }}>Agro Muda Anugerah</h2>
      </div>

      {/* Sheet */}
      <div style={{
        width: '100%', background: '#eef0f5',
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px 36px',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.25)',
      }}>
        {step === 'credentials' ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 4 }}>SELAMAT DATANG</div>
              <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px' }}>Masuk ke Akun</h3>
            </div>

            <form onSubmit={handleCredSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email */}
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email" placeholder="Email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={neuInput} required autoComplete="email"
                />
              </div>

              {/* Password */}
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#9a9db5" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type={showPass ? 'text' : 'password'} placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...neuInput, paddingRight: 44 }} required autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
                }}>
                  {showPass ? <EyeOff size={16} color="#9a9db5" /> : <Eye size={16} color="#9a9db5" />}
                </button>
              </div>

              {credError && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '12px', color: '#be123c' }}>{credError}</span>
                </div>
              )}

              <button type="submit" style={{
                height: 52, borderRadius: '14px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #2ea854, #1a6b3a)',
                color: '#fff', fontWeight: 700, fontSize: '14px',
                boxShadow: '4px 4px 14px rgba(26,107,58,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4,
              }}>
                Kirim OTP <ArrowRight size={16} />
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <button onClick={() => setStep('credentials')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9a9db5', padding: 0, marginBottom: 12 }}>
                ← Kembali
              </button>
              <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 4 }}>VERIFIKASI</div>
              <h3 style={{ margin: 0, color: '#2d3142', fontSize: '20px' }}>Masukkan Kode OTP</h3>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9a9db5' }}>
                Kode 8 digit dikirim ke <strong style={{ color: '#4a90d9' }}>{pendingEmail}</strong>
              </p>
            </div>

            {/* Demo OTP hint */}
            {pendingOtp && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
                padding: '9px 13px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: '14px' }}>🧪</span>
                <div>
                  <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 600 }}>MODE DEMO</div>
                  <div style={{ fontSize: '13px', color: '#78350f', fontWeight: 700, letterSpacing: '0.12em' }}>
                    {pendingOtp}
                  </div>
                </div>
              </div>
            )}

            {/* OTP inputs */}
            <div
              style={{
                display: 'flex', gap: 7, justifyContent: 'center', marginBottom: 18,
                animation: otpShake ? 'otp-shake 0.5s ease' : 'none',
              }}
            >
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  style={{
                    width: 36, height: 46, textAlign: 'center',
                    fontSize: '20px', fontWeight: 700, color: '#2d3142',
                    background: '#eef0f5',
                    boxShadow: digit
                      ? 'inset 3px 3px 6px #c8cad1, inset -3px -3px 6px #fff'
                      : '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff',
                    borderRadius: '10px', border: `2px solid ${digit ? '#4a90d9' : 'transparent'}`,
                    outline: 'none', transition: 'all 0.15s',
                  }}
                  autoFocus={i === 0}
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
              disabled={otp.some(d => !d)}
              style={{
                width: '100%', height: 52, borderRadius: '14px', border: 'none',
                cursor: otp.some(d => !d) ? 'default' : 'pointer',
                background: otp.some(d => !d) ? '#c8cad1' : 'linear-gradient(135deg, #2ea854, #1a6b3a)',
                color: '#fff', fontWeight: 700, fontSize: '14px',
                boxShadow: otp.some(d => !d) ? 'none' : '4px 4px 14px rgba(26,107,58,0.4)',
                transition: 'all 0.2s',
              }}
            >
              Verifikasi & Masuk
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button onClick={handleResend} disabled={resendTimer > 0} style={{
                background: 'transparent', border: 'none', cursor: resendTimer > 0 ? 'default' : 'pointer',
                fontSize: '12px', color: resendTimer > 0 ? '#b8bbd0' : '#4a90d9',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
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
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
