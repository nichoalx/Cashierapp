import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { formatRupiah } from '../store';
import { Search, UserPlus, Trash2, Phone, User, X, Users, ChevronRight } from 'lucide-react';

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

// Flexible formatter: groups digits as 4-4-rest for any length 1–13+
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
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

interface Member {
  id: Id<'members'>;
  name: string;
  phone: string;
  outstanding: number;
}

export default function MembersScreen() {
  const rawMembers = useQuery(api.members.list);
  const addMemberMutation = useMutation(api.members.add);
  const removeMemberMutation = useMutation(api.members.remove);
  const navigate = useNavigate();

  const members: Member[] = useMemo(
    () => (rawMembers ?? []).map(m => ({ id: m._id, name: m.name, phone: m.phone ?? '', outstanding: m.outstanding ?? 0 })),
    [rawMembers],
  );

  const addMember = useCallback((name: string, phone: string) => {
    void addMemberMutation({ name, phone: phone || undefined });
  }, [addMemberMutation]);

  const removeMember = useCallback((id: Id<'members'>) => {
    void removeMemberMutation({ memberId: id });
  }, [removeMemberMutation]);

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Id<'members'> | null>(null);
  const [nameError, setNameError] = useState('');
  const [savePressed, setSavePressed] = useState(false);
  const [dupWarn, setDupWarn] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: Id<'members'>; name: string } | null>(null);
  const [sortOrder, setSortOrder] = useState<'az' | 'newest'>('az');

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<{ id: Id<'members'>; name: string } | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<Id<'members'> | null>(null);
  const prevMembersLength = useRef(members.length);
  const recentlyAddedRef = useRef<HTMLDivElement | null>(null);

  // Keep ref in sync so the unmount cleanup can access current state
  useEffect(() => {
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);

  // On unmount: commit any pending soft-delete so navigation doesn't silently undo it
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (pendingDeleteRef.current) removeMember(pendingDeleteRef.current.id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect newly added member: apply highlight and scroll it into view
  useEffect(() => {
    if (members.length > prevMembersLength.current) {
      const newMember = members[members.length - 1];
      setRecentlyAddedId(newMember.id);
      const t = setTimeout(() => setRecentlyAddedId(null), 1800);
      prevMembersLength.current = members.length;
      return () => clearTimeout(t);
    }
    prevMembersLength.current = members.length;
  }, [members]);

  useEffect(() => {
    if (recentlyAddedId && recentlyAddedRef.current) {
      recentlyAddedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [recentlyAddedId]);

  // On iOS PWA the keyboard overlays without resizing the 100dvh chain.
  // Track visualViewport.height directly so the container shrinks correctly
  // when the form is open and the keyboard appears, keeping the save button visible.
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!showAdd) { setVpHeight(null); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVpHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => { vv.removeEventListener('resize', update); setVpHeight(null); };
  }, [showAdd]);

  const filtered = useMemo(() => {
    const base = pendingDelete
      ? members.filter(m => m.id !== pendingDelete.id)
      : members;
    const sorted = sortOrder === 'az'
      ? [...base].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
      : [...base].reverse();
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  }, [members, search, pendingDelete, sortOrder]);

  const effectiveTotal = members.length - (pendingDelete ? 1 : 0);
  const saveDisabled = !newName.trim();

  // Live phone preview and range warning for the add form
  const phoneDigits = newPhone.replace(/\D/g, '');
  const phonePreview = newPhone.trim() ? formatPhone(newPhone) : '';
  const phoneOutOfRange = newPhone.trim() !== '' && phoneDigits.length > 0 &&
    (phoneDigits.length < 10 || phoneDigits.length > 13);

  const handleAdd = () => {
    setNameError('');
    if (!newName.trim()) { setNameError('Nama tidak boleh kosong.'); return; }

    // Duplicate check — warn on first attempt, allow on second
    if (!dupWarn) {
      const isDuplicate = members.some(
        m => m.name.trim().toLowerCase() === newName.trim().toLowerCase()
      );
      if (isDuplicate) { setDupWarn(true); return; }
    }

    addMember(newName.trim(), newPhone.trim());
    setNewName('');
    setNewPhone('');
    setDupWarn(false);
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    // Commit any previous pending delete immediately before starting a new one
    if (pendingDelete) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      removeMember(pendingDelete.id);
    }

    const name = members.find(m => m.id === id)?.name ?? 'Anggota';
    setDeleteConfirm(null);
    setPendingDelete({ id, name });

    deleteTimerRef.current = setTimeout(() => {
      removeMember(id);
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDelete(null);
  };

  const handleBatal = () => {
    setShowAdd(false);
    setNameError('');
    setNewName('');
    setNewPhone('');
    setDupWarn(false);
  };

  // Name → focus phone; phone → submit
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); phoneInputRef.current?.focus(); }
  };
  const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saveDisabled) handleAdd();
  };

  return (
    <div
      className="members-screen"
      style={{
        ...(vpHeight !== null ? { height: vpHeight, flex: 'none' } : { flex: 1 }),
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        padding: '16px var(--app-page-gutter) 8px', gap: 12,
      }}
    >
      <style>{`
        @keyframes form-expand {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-added {
          0%   { box-shadow: 3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92); }
          12%  { box-shadow: 3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92), 0 0 0 2px #52b96a, 0 0 10px rgba(82,185,106,0.22); }
          100% { box-shadow: 3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        .members-screen button:focus-visible {
          outline: 2px solid #4a90d9;
          outline-offset: 2px;
        }
        .members-screen input:focus-visible {
          outline: 2px solid #4a90d9 !important;
          outline-offset: 2px;
        }
      `}</style>

      {/* Visually-hidden live region: announces member addition to screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {recentlyAddedId ? `Anggota ${members.find(m => m.id === recentlyAddedId)?.name ?? ''} ditambahkan` : ''}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>DIREKTORI</div>
          <h2 style={{ margin: '3px 0 0', fontSize: '20px', fontWeight: 700, lineHeight: 1.3, color: '#2d3142' }}>Anggota</h2>
        </div>
        <button
          onClick={showAdd ? handleBatal : () => setShowAdd(true)}
          style={{
            height: 40, padding: '0 16px', borderRadius: '11px', border: 'none', cursor: 'pointer',
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

            {/* Name */}
            <div>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#9a9db5" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Nama lengkap"
                  aria-label="Nama lengkap"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setNameError(''); setDupWarn(false); }}
                  onKeyDown={handleNameKeyDown}
                  style={{ ...neuInput, paddingLeft: 38 }}
                  autoFocus
                  maxLength={60}
                />
              </div>
              {nameError && (
                <div style={{ fontSize: '11px', color: '#d4183d', marginTop: 5, paddingLeft: 2 }}>{nameError}</div>
              )}
              {dupWarn && (
                <div style={{ fontSize: '11px', color: '#d4a017', marginTop: 5, paddingLeft: 2 }}>
                  Nama ini sudah terdaftar. Klik Simpan lagi untuk tetap menambahkan.
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <div style={{ position: 'relative' }}>
                <Phone size={14} color="#9a9db5" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  ref={phoneInputRef}
                  type="tel"
                  placeholder="Nomor HP (opsional)"
                  aria-label="Nomor HP, opsional"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  style={{ ...neuInput, paddingLeft: 38 }}
                />
              </div>
              {newPhone.trim() && (
                <div style={{ fontSize: '11px', color: phoneOutOfRange ? '#d4a017' : '#9a9db5', marginTop: 5, paddingLeft: 2 }}>
                  {phoneOutOfRange
                    ? `Periksa nomor: ${phoneDigits.length} digit (diharapkan 10–13)`
                    : phonePreview
                  }
                </div>
              )}
            </div>

            {/* Save */}
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
              <UserPlus size={15} />
              {dupWarn ? 'Tetap Simpan' : 'Simpan Anggota'}
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
          aria-label="Cari nama atau nomor HP"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...neuInput, paddingLeft: 38, paddingRight: search ? 36 : 14 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Bersihkan pencarian"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={13} color="#9a9db5" />
          </button>
        )}
      </div>

      {/* Count + sort toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#4a4e69' }}>
          {search.trim()
            ? `${filtered.length} dari ${effectiveTotal} anggota`
            : `${effectiveTotal} anggota`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {(['az', 'newest'] as const).map((mode, i) => (
            <React.Fragment key={mode}>
              {i > 0 && <span style={{ fontSize: '11px', color: '#c0c4d0', userSelect: 'none' }}>·</span>}
              <button
                onClick={() => setSortOrder(mode)}
                aria-pressed={sortOrder === mode}
                style={{
                  fontSize: '11px',
                  fontWeight: sortOrder === mode ? 700 : 400,
                  color: sortOrder === mode ? '#4a4e69' : '#c0c4d0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 8px', lineHeight: 1,
                  transition: 'color 0.15s',
                }}
              >
                {mode === 'az' ? 'A-Z' : 'Terbaru'}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Soft-delete undo toast */}
      {pendingDelete && (
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            background: '#eef0f5',
            boxShadow: SHD_RAISED_STD,
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
            animation: 'toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <Trash2 size={13} color="#c0c4d0" style={{ flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: '12px', color: '#9a9db5',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {pendingDelete.name} dihapus
          </span>
          <button
            onClick={handleUndoDelete}
            style={{
              height: 40, padding: '0 14px', borderRadius: '11px', border: 'none', cursor: 'pointer',
              background: '#eef0f5',
              boxShadow: SHD_RAISED_STD,
              color: '#4a90d9', fontSize: '12px', fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Urungkan
          </button>
        </div>
      )}

      {/* Member list */}
      <ul
        role="list"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          margin: '0 -8px',
          padding: '4px 8px var(--app-content-bottom)',
          listStyle: 'none',
        }}
      >
        {filtered.length === 0 ? (
          <li>
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
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#4a4e69' }}>
                {search ? 'Tidak ditemukan' : 'Belum ada anggota'}
              </div>
              {!search && (
                <div style={{ fontSize: '11px', color: '#c0c4d0', marginTop: 5 }}>
                  Klik "Tambah" untuk menambahkan anggota pertama
                </div>
              )}
            </div>
          </li>
        ) : (
          filtered.map(m => {
            const color = getAvatarColor(m.id);
            const confirming = deleteConfirm === m.id;
            const justAdded = recentlyAddedId === m.id;
            return (
              <li key={m.id} style={{ listStyle: 'none', flexShrink: 0 }}>
              <div
                ref={justAdded ? recentlyAddedRef : undefined}
                onClick={() => navigate(`/members/${m.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/members/${m.id}`); }}
                aria-label={`Lihat detail ${m.name}`}
                style={{
                  background: '#eef0f5',
                  boxShadow: SHD_RAISED_LIST,
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer',
                  ...(justAdded && { animation: 'card-added 1400ms cubic-bezier(0.16, 1, 0.3, 1) both' }),
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
                  <div style={{
                    fontSize: '14px', fontWeight: 700, color: '#2d3142', marginBottom: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {m.outstanding > 0 ? (
                      <span style={{ fontSize: '11px', color: '#d4a017', fontWeight: 600 }}>
                        Hutang {formatRupiah(m.outstanding)}
                      </span>
                    ) : (
                      <>
                        <Phone size={10} color="#c0c4d0" />
                        <span style={{ fontSize: '11px', color: '#4a4e69' }}>
                          {m.phone ? formatPhone(m.phone) : '—'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Delete + chevron */}
                {confirming ? (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}
                  >
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>Hapus?</span>
                    <button
                      onClick={() => handleDelete(m.id)}
                      aria-label="Konfirmasi hapus"
                      style={{
                        width: 44, height: 44, borderRadius: '9px', border: 'none', cursor: 'pointer',
                        background: '#d4183d',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={13} color="#ffffff" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      aria-label="Batal hapus"
                      style={{
                        width: 44, height: 44, borderRadius: '9px', border: 'none', cursor: 'pointer',
                        background: '#eef0f5',
                        boxShadow: SHD_RAISED_STD,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={13} color="#9a9db5" />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(m.id); }}
                      aria-label={`Hapus ${m.name}`}
                      style={{
                        width: 36, height: 36, borderRadius: '9px', border: 'none', cursor: 'pointer',
                        background: '#eef0f5',
                        boxShadow: SHD_RAISED_STD,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={13} color="#c0c4d0" />
                    </button>
                    <ChevronRight size={14} color="#c0c4d0" />
                  </div>
                )}
              </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
