import { useState } from 'react';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';

const SHD_RAISED_STRONG = '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff';
const SHD_RAISED_STD = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RECESSED = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';
const SHD_ACTION_PRESS = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)';
const MOTION_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Terjadi kendala saat menampilkan layar ini.';
}

export default function AppErrorScreen() {
  const error = useRouteError();
  const navigate = useNavigate();
  const [reloadPressed, setReloadPressed] = useState(false);
  const [loginPressed, setLoginPressed] = useState(false);
  const message = getErrorMessage(error);

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      background: '#dfe3ea',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style>
        {`
          @keyframes app-error-enter {
            from { opacity: 0; transform: translateY(10px) scale(0.985); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          @media (prefers-reduced-motion: reduce) {
            .app-error-motion {
              animation: none !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}
      </style>

      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: 430,
        background: '#eef0f5',
        boxShadow: '0 0 60px rgba(0,0,0,0.12)',
        padding: '22px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 18,
      }}>
        <div
          className="app-error-motion"
          style={{
            background: '#eef0f5',
            boxShadow: SHD_RAISED_STRONG,
            borderRadius: 20,
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 14,
            animation: `app-error-enter 180ms ${MOTION_EASE} both`,
          }}
        >
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: '#eef0f5',
            boxShadow: SHD_RECESSED,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertTriangle size={24} color="#e05a6a" strokeWidth={2.2} />
          </div>

          <div>
            <div style={{
              fontSize: 9,
              fontWeight: 600,
              color: '#9a9db5',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              Sistem
            </div>
            <h1 style={{
              margin: 0,
              color: '#2d3142',
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.3,
            }}>
              Layar tidak bisa dimuat
            </h1>
          </div>

          <p style={{
            margin: 0,
            color: '#4a4e69',
            fontSize: 12,
            lineHeight: 1.55,
            maxWidth: 310,
          }}>
            Data kamu tetap aman. Muat ulang layar ini, atau kembali ke login untuk memulai sesi baru.
          </p>

          {message && (
            <div style={{
              width: '100%',
              minHeight: 42,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#eef0f5',
              boxShadow: SHD_RECESSED,
              color: '#9a9db5',
              fontSize: 10,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}>
              {message}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              flex: 2,
              height: 48,
              border: 'none',
              borderRadius: 14,
              background: '#4a90d9',
              boxShadow: reloadPressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
              transform: reloadPressed ? 'translateY(1px) scale(0.975)' : 'translateY(0) scale(1)',
              color: '#f7fbff',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: `box-shadow 90ms ${MOTION_EASE}, transform 90ms ${MOTION_EASE}`,
            }}
            onPointerDown={() => setReloadPressed(true)}
            onPointerUp={() => setReloadPressed(false)}
            onPointerLeave={() => setReloadPressed(false)}
          >
            <RotateCw size={16} />
            Muat Ulang
          </button>

          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            style={{
              flex: 1,
              height: 48,
              border: 'none',
              borderRadius: 14,
              background: '#eef0f5',
              boxShadow: loginPressed ? SHD_RECESSED : SHD_RAISED_STD,
              transform: loginPressed ? 'translateY(1px) scale(0.98)' : 'translateY(0) scale(1)',
              color: '#9a9db5',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              cursor: 'pointer',
              transition: `box-shadow 90ms ${MOTION_EASE}, transform 90ms ${MOTION_EASE}`,
            }}
            onPointerDown={() => setLoginPressed(true)}
            onPointerUp={() => setLoginPressed(false)}
            onPointerLeave={() => setLoginPressed(false)}
          >
            <Home size={15} />
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
