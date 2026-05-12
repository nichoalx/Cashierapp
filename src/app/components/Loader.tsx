export function ButtonSpinner({ color = '#fff' }: { color?: string }) {
  return (
    <>
      <style>{`@keyframes _btn-spin { to { transform: rotate(360deg); } }`}</style>
      <svg
        width="15" height="15" viewBox="0 0 16 16"
        style={{ animation: '_btn-spin 0.65s linear infinite', flexShrink: 0, display: 'block' }}
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="2.5" />
        <path d="M8 2.5 A5.5 5.5 0 0 1 13.5 8" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </>
  );
}

export function BouncingLoader() {
  return (
    <>
      <style>{`
        @keyframes _bdot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40%            { transform: translateY(-9px); opacity: 1; }
        }
      `}</style>
      <div style={{
        width: '100%', height: '100%',
        background: '#eef0f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {([0, 1, 2] as const).map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#4a90d9',
              animation: `_bdot 1.05s ease-in-out infinite`,
              animationDelay: `${i * 0.17}s`,
            }} />
          ))}
        </div>
      </div>
    </>
  );
}
