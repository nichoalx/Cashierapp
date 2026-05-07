import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Search, UserPlus, Trash2, Phone, User, X, Users } from 'lucide-react';

const SHD_RAISED_STD    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RAISED_LIST   = '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92)';
const SHD_RAISED_STRONG = '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff';
const SHD_RECESSED_STD  = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';
const SHD_ACTION_PRESS  = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)';

const neuInput: React.CSSProperties = {
  background: '#eef0f5',
  boxShadow: SHD_RECESSED_STD,
  borderRadius: '12px',
  border: 'none',
  outline: 'none',
  padding: '11px 14px',
  fontSize: '14px',
  color: '#2d3142',
  width: '100%',
  boxSizing: 'border-box' as const,
};

function formatPhone(phone: string) {
  return phone.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#f5903d', '#4a90d9', '#52b96a', '#9b6dff',
  '#e05a6a', '#38b2ac', '#d4a017', '#e84393',
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function MembersScreen() {
  const { members, addMember, removeMember } = useAppStore();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [savePressed, setSavePressed] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  }, [members, search]);

  const saveDisabled = !newName.trim();

  const handleAdd = () => {
    setNameError('');
    if (!newName.trim()) { setNameError('Nama tidak boleh kosong.'); return; }
    addMember(newName.trim(), newPhone.trim());
    setNewName('');
    setNewPhone('');
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    removeMember(id);
    setDeleteConfirm(null);
  };

  const handleBatal = () => {
    setShowAdd(false);
    setNameError('');
    setNewName('');
    setNewPhone('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saveDisabled) handleAdd();
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 16px 8px', gap: 12 }}>
      <style>{`
        @keyframes form-expand {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>DIREKTORI</div>
          <h2 style={{ margin: '3px 0 0', fontSize: '20px', fontWeight: 700, lineHeight: 1.3, color: '#2d3142' }}>Anggota</h2>
        </div>
        <button
          onClick={showAdd ? handleBatal : () => setShowAdd(true)}
          style={{
            height: 36, padding: '0 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: '#eef0f5',
            boxShadow: showAdd ? SHD_RECESSED_STD : SHD_RAISED_STD,
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#4a90d9', fontSize: '12px', fontWeight: 700,
            transition: 'box-shadow 0.15s',
          }}
        >
          {showAdd ? <X size={14} /> : <UserPlus size={14} />}
          {showAdd ? 'Batal' : 'Tambah'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{
          background: '#eef0f5',
          boxShadow: SHD_RAISED_STRONG,
          borderRadius: '16px',
          padding: '16px',
          animation: 'form-expand 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 14 }}>ANGGOTA BARU</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#9a9db5" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Nama lengkap"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setNameError(''); }}
                  onKeyDown={handleKeyDown}
                  style={{ ...neuInput, paddingLeft: 38 }}
                  autoFocus
                />
              </div>
              {nameError && (
                <div style={{ fontSize: '11px', color: '#d4183d', marginTop: 5, paddingLeft: 2 }}>{nameError}</div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <Phone size={14} color="#9a9db5" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="tel"
                placeholder="Nomor HP (opsional)"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...neuInput, paddingLeft: 38 }}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saveDisabled}
              onPointerDown={() => setSavePressed(true)}
              onPointerUp={() => setSavePressed(false)}
              onPointerLeave={() => setSavePressed(false)}
              style={{
                height: 46, borderRadius: '14px', border: 'none',
                cursor: saveDisabled ? 'default' : 'pointer',
                background: saveDisabled ? '#a8acbe' : '#4a90d9',
                opacity: saveDisabled ? 0.5 : 1,
                color: '#ffffff', fontWeight: 700, fontSize: '13px',
                boxShadow: saveDisabled
                  ? 'none'
                  : savePressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                transform: savePressed && !saveDisabled ? 'scale(0.97)' : 'scale(1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'box-shadow 0.07s, transform 0.07s, opacity 0.15s',
              }}
            >
              <UserPlus size={15} /> Simpan Anggota
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} color="#9a9db5" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...neuInput, paddingLeft: 38, paddingRight: search ? 36 : 14 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={13} color="#9a9db5" />
          </button>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: '11px', color: '#9a9db5' }}>
        {search.trim()
          ? `${filtered.length} dari ${members.length} anggota`
          : `${members.length} anggota`}
      </div>

      {/* Member list */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        margin: '0 -8px',
        padding: '4px 8px 14px',
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '14px',
              background: '#eef0f5',
              boxShadow: SHD_RAISED_STD,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              {search ? <Search size={22} color="#c0c4d0" /> : <Users size={22} color="#c0c4d0" />}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#9a9db5' }}>
              {search ? 'Tidak ditemukan' : 'Belum ada anggota'}
            </div>
            {!search && (
              <div style={{ fontSize: '11px', color: '#c0c4d0', marginTop: 5 }}>
                Klik "Tambah" untuk menambahkan anggota pertama
              </div>
            )}
          </div>
        ) : (
          filtered.map(m => {
            const color = getAvatarColor(m.id);
            const confirming = deleteConfirm === m.id;
            return (
              <div
                key={m.id}
                style={{
                  background: '#eef0f5',
                  boxShadow: SHD_RAISED_LIST,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
                  background: `${color}1e`,
                  boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color, lineHeight: 1 }}>{initials(m.name)}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142', marginBottom: 3 }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={10} color="#c0c4d0" />
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>
                      {m.phone ? formatPhone(m.phone) : '—'}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                {confirming ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>Hapus?</span>
                    <button
                      onClick={() => handleDelete(m.id)}
                      style={{
                        width: 32, height: 32, borderRadius: '9px', border: 'none', cursor: 'pointer',
                        background: '#d4183d',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={13} color="#ffffff" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      style={{
                        width: 32, height: 32, borderRadius: '9px', border: 'none', cursor: 'pointer',
                        background: '#eef0f5',
                        boxShadow: SHD_RAISED_STD,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={13} color="#9a9db5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(m.id)}
                    style={{
                      width: 32, height: 32, borderRadius: '9px', border: 'none', cursor: 'pointer',
                      background: '#eef0f5',
                      boxShadow: SHD_RAISED_STD,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={13} color="#c0c4d0" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
