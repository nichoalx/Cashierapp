import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Search, UserPlus, Trash2, Phone, User, X } from 'lucide-react';

const neuCard: React.CSSProperties = {
  background: '#eef0f5',
  boxShadow: '3px 3px 8px #caccd4, -2px -2px 6px rgba(255,255,255,0.75)',
  borderRadius: '14px',
};

const neuInput: React.CSSProperties = {
  background: '#eef0f5',
  boxShadow: 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff',
  borderRadius: '11px',
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

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  }, [members, search]);

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

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 16px 8px', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.08em' }}>DIREKTORI</div>
          <h2 style={{ margin: '2px 0 0', color: '#2d3142' }}>Anggota</h2>
        </div>
        <button
          onClick={() => { setShowAdd(s => !s); setNameError(''); }}
          style={{
            height: 36, padding: '0 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: '#eef0f5',
            boxShadow: showAdd
              ? 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff'
              : '3px 3px 8px #caccd4, -2px -2px 6px rgba(255,255,255,0.75)',
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#4a90d9', fontSize: '12px', fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          {showAdd ? <X size={14} /> : <UserPlus size={14} />}
          {showAdd ? 'Batal' : 'Tambah'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...neuCard, padding: '14px' }}>
          <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12 }}>ANGGOTA BARU</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#9a9db5" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Nama lengkap"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setNameError(''); }}
                  style={{ ...neuInput, paddingLeft: 36 }}
                  autoFocus
                />
              </div>
              {nameError && <div style={{ fontSize: '11px', color: '#e05a6a', marginTop: 4 }}>{nameError}</div>}
            </div>
            <div style={{ position: 'relative' }}>
              <Phone size={14} color="#9a9db5" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="tel"
                placeholder="Nomor HP (opsional)"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                style={{ ...neuInput, paddingLeft: 36 }}
              />
            </div>
            <button
              onClick={handleAdd}
              style={{
                height: 46, borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #4a90d9, #2563eb)',
                color: '#fff', fontWeight: 700, fontSize: '13px',
                boxShadow: '3px 3px 10px rgba(74,144,217,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <UserPlus size={15} /> Simpan Anggota
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} color="#9a9db5" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Cari nama atau nomor HP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...neuInput, paddingLeft: 36, paddingRight: search ? 36 : 14, fontSize: '13px' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={13} color="#9a9db5" />
          </button>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: '11px', color: '#b0b4c8' }}>
        {filtered.length} dari {members.length} anggota
      </div>

      {/* Member list */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '32px', marginBottom: 10 }}>{search ? '🔍' : '👥'}</div>
            <div style={{ fontSize: '13px', color: '#9a9db5' }}>
              {search ? 'Tidak ditemukan' : 'Belum ada anggota'}
            </div>
            {!search && (
              <div style={{ fontSize: '11px', color: '#c0c4d0', marginTop: 4 }}>
                Klik "Tambah" untuk menambahkan anggota pertama
              </div>
            )}
          </div>
        ) : (
          filtered.map(m => {
            const color = getAvatarColor(m.id);
            const confirming = deleteConfirm === m.id;
            return (
              <div key={m.id} style={{ ...neuCard, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: '13px', flexShrink: 0,
                  background: `${color}18`,
                  border: `1.5px solid ${color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color }}>{initials(m.name)}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142', marginBottom: 2 }}>{m.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={10} color="#b0b4c8" />
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>
                      {m.phone ? formatPhone(m.phone) : '—'}
                    </span>
                  </div>
                </div>

                {/* Delete */}
                {confirming ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>Hapus?</span>
                    <button onClick={() => handleDelete(m.id)} style={{
                      width: 30, height: 30, borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: '#e05a6a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Trash2 size={12} color="#fff" />
                    </button>
                    <button onClick={() => setDeleteConfirm(null)} style={{
                      width: 30, height: 30, borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: '#eef0f5', boxShadow: '2px 2px 5px #c8cad1, -2px -2px 5px #ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <X size={12} color="#9a9db5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(m.id)} style={{
                    width: 32, height: 32, borderRadius: '9px', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: '2px 2px 5px #c8cad1, -2px -2px 5px rgba(255,255,255,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
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
