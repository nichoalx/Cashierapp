import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { formatRupiah } from '../store';
import { Search, UserPlus, Trash2, Phone, User, X, Users, Pencil, Check, MoreVertical } from 'lucide-react';

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
  '#6366f1', '#0ea5e9', '#14b8a6', '#64748b',
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
  color?: string;
  profileImageUrl?: string;
}

const SHD_RECESSED_MODAL = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_MODAL   = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';

const CROP_CONTAINER = 280;
const CROP_R = 110;

function CropModal({ file, onConfirm, onCancel }: {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [imgUrl] = useState(() => URL.createObjectURL(file));
  const [natW, setNatW] = useState(0);
  const [natH, setNatH] = useState(0);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; stx: number; sty: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(imgUrl), [imgUrl]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNatW(img.naturalWidth);
      setNatH(img.naturalHeight);
      setScale((CROP_R * 2) / Math.min(img.naturalWidth, img.naturalHeight));
    };
    img.src = imgUrl;
  }, [imgUrl]);

  const minScale = natW > 0 ? (CROP_R * 2) / Math.min(natW, natH) : 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      dragRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, stx: tx, sty: ty };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      dragRef.current = null;
      pinchRef.current = {
        startDist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
        startScale: scale,
      };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragRef.current) {
      setTx(dragRef.current.stx + e.touches[0].clientX - dragRef.current.sx);
      setTy(dragRef.current.sty + e.touches[0].clientY - dragRef.current.sy);
    } else if (e.touches.length === 2 && pinchRef.current) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setScale(Math.max(minScale, pinchRef.current.startScale * dist / pinchRef.current.startDist));
    }
  };
  const handleTouchEnd = () => { dragRef.current = null; pinchRef.current = null; };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, stx: tx, sty: ty };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setTx(dragRef.current.stx + e.clientX - dragRef.current.sx);
    setTy(dragRef.current.sty + e.clientY - dragRef.current.sy);
  };
  const handleMouseUp = () => { dragRef.current = null; };

  const handleConfirm = () => {
    const OUT = 240;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx2 = canvas.getContext('2d')!;
    const imgLeft = CROP_CONTAINER / 2 + tx - (natW * scale) / 2;
    const imgTop  = CROP_CONTAINER / 2 + ty - (natH * scale) / 2;
    const cropLeft = CROP_CONTAINER / 2 - CROP_R;
    const cropTop  = CROP_CONTAINER / 2 - CROP_R;
    ctx2.drawImage(
      imgRef.current!,
      (cropLeft - imgLeft) / scale, (cropTop - imgTop) / scale,
      (CROP_R * 2) / scale, (CROP_R * 2) / scale,
      0, 0, OUT, OUT,
    );
    canvas.toBlob(b => { if (b) onConfirm(b); }, 'image/jpeg', 0.4);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#161618', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      {/* Crop area */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: CROP_CONTAINER, height: CROP_CONTAINER, position: 'relative', overflow: 'hidden', borderRadius: 8, userSelect: 'none', touchAction: 'none', cursor: 'grab', flexShrink: 0 }}
      >
        {natW > 0 && (
          <img
            ref={imgRef}
            src={imgUrl}
            draggable={false}
            style={{
              position: 'absolute',
              width: natW * scale,
              height: natH * scale,
              left: '50%', top: '50%',
              transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`,
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Dimmed overlay with rounded-square cutout matching the avatar shape */}
        <svg width={CROP_CONTAINER} height={CROP_CONTAINER} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <defs>
            <mask id="crop-mask">
              <rect width={CROP_CONTAINER} height={CROP_CONTAINER} fill="white" />
              <rect x={CROP_CONTAINER / 2 - CROP_R} y={CROP_CONTAINER / 2 - CROP_R} width={CROP_R * 2} height={CROP_R * 2} rx="14" fill="black" />
            </mask>
          </defs>
          <rect width={CROP_CONTAINER} height={CROP_CONTAINER} fill="rgba(0,0,0,0.58)" mask="url(#crop-mask)" />
          <rect x={CROP_CONTAINER / 2 - CROP_R} y={CROP_CONTAINER / 2 - CROP_R} width={CROP_R * 2} height={CROP_R * 2} rx="14" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Zoom slider */}
      <input
        type="range"
        min={Math.round(minScale * 100)}
        max={Math.round(minScale * 400)}
        value={Math.round(scale * 100)}
        onChange={e => setScale(Number(e.target.value) / 100)}
        style={{ width: CROP_CONTAINER, accentColor: '#4a90d9' }}
      />

      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.03em' }}>
        Geser · cubit atau slider untuk zoom
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit' }}
        >
          Batal
        </button>
        <button
          onClick={handleConfirm}
          style={{ height: 44, padding: '0 28px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#4a90d9', color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit' }}
        >
          Pakai Foto
        </button>
      </div>
    </div>
  );
}


function EditMemberModal({ member, onSave, onClose }: {
  member: Member;
  onSave: (id: Id<'members'>, name: string, phone: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [color, setColor] = useState(member.color ?? getAvatarColor(member.id));
  const [nameError, setNameError] = useState('');
  const [pressed, setPressed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(member.profileImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.members.generateUploadUrl);
  const setProfileImageMutation = useMutation(api.members.setProfileImage);
  const removeProfileImageMutation = useMutation(api.members.removeProfileImage);

  const valid = name.trim().length > 0;
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneOutOfRange = phone.trim() !== '' && phoneDigits.length > 0 &&
    (phoneDigits.length < 10 || phoneDigits.length > 13);

  const handleSave = () => {
    if (!valid) { setNameError('Nama tidak boleh kosong.'); return; }
    onSave(member.id, name.trim(), phone.trim(), color);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPendingFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setPendingFile(null);
    const localUrl = URL.createObjectURL(blob);
    setPreviewUrl(localUrl);
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const { storageId } = await res.json() as { storageId: string };
      await setProfileImageMutation({ memberId: member.id, storageId: storageId as Id<'_storage'> });
    } catch {
      setPreviewUrl(member.profileImageUrl ?? null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setPreviewUrl(null);
    await removeProfileImageMutation({ memberId: member.id });
  };

  return (
    <>
      {pendingFile && (
        <CropModal
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}
      <div
        style={{ position: 'fixed', left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#eef0f5', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 430, boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', padding: '20px 16px 32px', animation: 'sheet-up 250ms cubic-bezier(0.16,1,0.3,1) both' }}
        >
          {/* Avatar + header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{ width: 52, height: 52, borderRadius: '14px', background: `${color}1e`, boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'default' : 'pointer', overflow: 'hidden', position: 'relative' }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '14px', fontWeight: 800, color, lineHeight: 1 }}>{initials(name || member.name)}</span>
                )}
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                )}
                {!uploading && (
                  <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.45)', borderRadius: '6px 0 0 0', padding: '2px 4px', lineHeight: 1, fontSize: 9, color: '#fff' }}>✎</div>
                )}
              </div>
              {/* Remove button — only shown when there's a photo */}
              {previewUrl && !uploading && (
                <button
                  onClick={handleRemove}
                  aria-label="Hapus foto"
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#d4183d', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '1px 1px 4px rgba(0,0,0,0.3)' }}
                >
                  <X size={9} color="#fff" />
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <div>
              <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em' }}>EDIT ANGGOTA</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#2d3142' }}>{member.name}</div>
              <div style={{ fontSize: '10px', color: '#9a9db5', marginTop: 1 }}>Ketuk foto untuk ganti</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Name */}
            <div>
              <input
                type="text"
                placeholder="Nama lengkap"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
                autoFocus
                maxLength={60}
                style={{ width: '100%', boxSizing: 'border-box', background: '#eef0f5', boxShadow: SHD_RECESSED_MODAL, borderRadius: 12, border: 'none', outline: 'none', padding: '11px 14px', fontSize: '14px', color: '#2d3142', fontFamily: 'inherit' }}
              />
              {nameError && <div style={{ fontSize: '11px', color: '#d4183d', marginTop: 4, paddingLeft: 2 }}>{nameError}</div>}
            </div>

            {/* Phone */}
            <div>
              <input
                type="tel"
                placeholder="Nomor HP (opsional)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: '#eef0f5', boxShadow: SHD_RECESSED_MODAL, borderRadius: 12, border: 'none', outline: 'none', padding: '11px 14px', fontSize: '14px', color: '#2d3142', fontFamily: 'inherit' }}
              />
              {phone.trim() && (
                <div style={{ fontSize: '11px', color: phoneOutOfRange ? '#d4a017' : '#9a9db5', marginTop: 4, paddingLeft: 2 }}>
                  {phoneOutOfRange ? `Periksa nomor: ${phoneDigits.length} digit (diharapkan 10–13)` : formatPhone(phone)}
                </div>
              )}
            </div>

            {/* Color picker */}
            <div>
              <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 8 }}>WARNA AVATAR</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: '100%', aspectRatio: '1 / 1', borderRadius: '10px', background: c, border: 'none', cursor: 'pointer',
                      boxShadow: color === c
                        ? `0 0 0 2px #eef0f5, 0 0 0 4px ${c}, 2px 2px 6px #c8cad1`
                        : '2px 2px 5px rgba(0,0,0,0.12), -1px -1px 4px rgba(255,255,255,0.7)',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!valid}
              onPointerDown={() => setPressed(true)}
              onPointerUp={() => setPressed(false)}
              onPointerLeave={() => setPressed(false)}
              style={{ height: 48, borderRadius: 14, border: 'none', cursor: valid ? 'pointer' : 'default', background: valid ? '#4a90d9' : '#a8acbe', color: '#fff', fontWeight: 700, fontSize: '14px', boxShadow: pressed && valid ? 'inset 3px 3px 8px rgba(0,0,0,0.22)' : SHD_ACTION_MODAL, transform: pressed && valid ? 'scale(0.97)' : 'scale(1)', transition: 'box-shadow 0.07s, transform 0.07s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Check size={15} /> Simpan Perubahan
            </button>
          </div>
        </div>
        <style>{`
          @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
}

function MembersScreenSkeleton() {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px var(--app-page-gutter) 8px', gap: 12 }}>
      <style>{`@keyframes skel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: 60, height: 9, borderRadius: 4, background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
          <div style={{ width: 100, height: 22, borderRadius: 6, background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
        </div>
        <div style={{ width: 90, height: 40, borderRadius: 11, background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
      </div>
      {/* Search */}
      <div style={{ width: '100%', height: 44, borderRadius: 12, background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
      {/* Count row */}
      <div style={{ width: 90, height: 14, borderRadius: 5, background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
      {/* Member cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#e8eaf0', borderRadius: 14, padding: '12px 14px', flexShrink: 0, animation: 'skel-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 60}ms` }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#dde0e8', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ width: '55%', height: 13, borderRadius: 5, background: '#dde0e8' }} />
              <div style={{ width: '35%', height: 10, borderRadius: 4, background: '#dde0e8' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MembersScreen() {
  const rawMembers = useQuery(api.members.list);
  const addMemberMutation = useMutation(api.members.add);
  const updateMemberMutation = useMutation(api.members.update);
  const removeMemberMutation = useMutation(api.members.remove);
  const navigate = useNavigate();

  const members: Member[] = useMemo(
    () => (rawMembers ?? []).map(m => ({ id: m._id, name: m.name, phone: m.phone ?? '', outstanding: m.outstanding ?? 0, color: m.color, profileImageUrl: m.profileImageUrl })),
    [rawMembers],
  );

  const addMember = useCallback((name: string, phone: string) => {
    void addMemberMutation({ name, phone: phone || undefined });
  }, [addMemberMutation]);

  const handleEditSave = useCallback((id: Id<'members'>, name: string, phone: string, color: string) => {
    void updateMemberMutation({ memberId: id, name, phone: phone || undefined, color });
  }, [updateMemberMutation]);

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
  const [sortOrder, setSortOrder] = useState<'az' | 'newest' | 'hutang'>(() => {
    const saved = localStorage.getItem('members_sort_order');
    return saved === 'az' || saved === 'newest' || saved === 'hutang' ? saved : 'az';
  });
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [actionsOpen, setActionsOpen] = useState<Id<'members'> | null>(null);

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

  // Detect newly added member: apply highlight and scroll it into view.
  // Guard prevMembersLength.current > 0 so the initial data load (0 → N) is ignored.
  useEffect(() => {
    if (prevMembersLength.current > 0 && members.length > prevMembersLength.current) {
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
      : sortOrder === 'hutang'
      ? [...base].sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
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

  if (rawMembers === undefined) return <MembersScreenSkeleton />;

  return (
    <div
      className="members-screen"
      style={{
        ...(vpHeight !== null ? { height: vpHeight, flex: 'none' } : { flex: 1 }),
        overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column',
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

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onSave={handleEditSave}
          onClose={() => setEditingMember(null)}
        />
      )}

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
          {(['az', 'newest', 'hutang'] as const).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ fontSize: '11px', color: '#c0c4d0', userSelect: 'none' }}>·</span>}
              <button
                onClick={() => { setSortOrder(s); localStorage.setItem('members_sort_order', s); }}
                aria-pressed={sortOrder === s}
                style={{
                  fontSize: '11px',
                  fontWeight: sortOrder === s ? 700 : 400,
                  color: sortOrder === s ? (s === 'hutang' ? '#d4a017' : '#4a4e69') : '#c0c4d0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 8px', lineHeight: 1,
                  transition: 'color 0.15s',
                }}
              >
                {s === 'az' ? 'A-Z' : s === 'newest' ? 'Terbaru' : 'Hutang'}
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
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 14px, black 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0px, black 14px, black 100%)',
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
            const color = m.color ?? getAvatarColor(m.id);
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
                  overflow: 'hidden',
                }}>
                  {m.profileImageUrl
                    ? <img src={m.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '13px', fontWeight: 800, color, lineHeight: 1 }}>{initials(m.name)}</span>
                  }
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
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setActionsOpen(actionsOpen === m.id ? null : m.id); }}
                      aria-label={`Opsi untuk ${m.name}`}
                      style={{ width: 32, height: 32, borderRadius: '9px', border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED_STD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MoreVertical size={14} color="#9a9db5" />
                    </button>
                    {actionsOpen === m.id && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setActionsOpen(null); }} />
                        <div style={{ position: 'absolute', right: 0, top: 36, zIndex: 11, background: '#eef0f5', boxShadow: '5px 5px 14px #c0c3ca, -5px -5px 14px #ffffff', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingMember(m); setActionsOpen(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', fontSize: '13px', color: '#2d3142', fontWeight: 600, fontFamily: 'inherit' }}
                          >
                            <Pencil size={13} color="#9a9db5" /> Edit
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(m.id); setActionsOpen(null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', width: '100%', fontSize: '13px', color: '#d4183d', fontWeight: 600, fontFamily: 'inherit' }}
                          >
                            <Trash2 size={13} color="#d4183d" /> Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Bottom gradient fade overlay */}
      <div aria-hidden style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 72,
        background: 'linear-gradient(to bottom, transparent, #eef0f5)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
    </div>
  );
}
