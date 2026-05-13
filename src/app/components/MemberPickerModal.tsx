import React, { useState, useEffect } from 'react';
import { X, Search, Phone } from 'lucide-react';
import { Member } from '../store';

function getAvatarColor(id: string) {
  const COLORS = ['#f5903d', '#4a90d9', '#52b96a', '#9b6dff', '#e05a6a', '#38b2ac', '#d4a017', '#e84393'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + hash * 31;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function MemberPickerModal({ members, onSelect, onClose }: {
  members: Member[];
  onSelect: (m: Member | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  return (
    <>
      <style>{`
        @keyframes member-picker-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      <div
        style={{ position: 'fixed', left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#eef0f5', borderRadius: '22px 22px 0 0',
            width: '100%', maxWidth: 430, maxHeight: 'min(60vh, calc(var(--app-visual-height) - 16px))',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'member-picker-slide-up 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 2 }}>PILIH</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142', marginBottom: 10 }}>Pembeli / Anggota</div>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#9a9db5" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text" placeholder="Cari nama atau HP..."
                value={search} onChange={e => setSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#eef0f5',
                  boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff',
                  borderRadius: '10px', border: 'none', outline: 'none',
                  padding: '9px 12px 9px 30px', fontSize: '13px', color: '#2d3142',
                }}
              />
            </div>
          </div>

          <div style={{ overflow: 'auto', padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => { onSelect(null); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: '11px', border: 'none', cursor: 'pointer',
                background: '#eef0f5',
                boxShadow: '2px 2px 6px #caccd4, -2px -2px 4px rgba(255,255,255,0.8)',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color="#9a9db5" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#9a9db5' }}>Tanpa Pembeli</span>
            </button>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#b0b4c8', fontSize: '12px' }}>
                {search ? 'Tidak ditemukan' : 'Belum ada anggota'}
              </div>
            )}
            {filtered.map(m => {
              const color = getAvatarColor(m.id);
              return (
                <button key={m.id}
                  onClick={() => { onSelect(m); onClose(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: '11px', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: '2px 2px 6px #caccd4, -2px -2px 4px rgba(255,255,255,0.8)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                    background: `${color}1a`,
                    boxShadow: '2px 2px 5px #c8cad1, -2px -2px 5px rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color }}>{initials(m.name)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{m.name}</div>
                    <div style={{ fontSize: '10px', color: '#9a9db5', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Phone size={9} color="#b0b4c8" /> {m.phone || '—'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
