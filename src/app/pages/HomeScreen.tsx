import React, { useState } from 'react';
import { X, MessageSquare, User, Search, Phone } from 'lucide-react';
import { useAppStore, formatRupiah, TransactionItem, Member } from '../store';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';
import { Numpad } from '../components/Numpad';

type Step =
  | { type: 'idle' }
  | { type: 'plastic_size' }
  | { type: 'quantity'; productId: string; productName: string; productShortName: string; unit: string; unitPrice: number; color: string; plasticSize?: string };

function genId() { return Math.random().toString(36).slice(2, 10); }

const PLASTIC_COLOR = '#38b2ac';

function getAvatarColor(id: string) {
  const COLORS = ['#f5903d', '#4a90d9', '#52b96a', '#9b6dff', '#e05a6a', '#38b2ac', '#d4a017', '#e84393'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + hash * 31;
  return COLORS[Math.abs(hash) % COLORS.length];
}
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

// Member picker modal
function MemberPickerModal({ members, onSelect, onClose }: {
  members: Member[];
  onSelect: (m: Member | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#eef0f5', borderRadius: '22px 22px 0 0',
          width: '100%', maxWidth: 430, maxHeight: '60vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
          overflow: 'hidden',
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
          {/* Clear selection */}
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
                  background: `${color}1a`, border: `1.5px solid ${color}30`,
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
  );
}

export default function HomeScreen() {
  const { soybeanProducts, plasticSizes, plasticBasePrice, otherProducts, addTransaction, members } = useAppStore();
  const [step, setStep] = useState<Step>({ type: 'idle' });
  const [inputValue, setInputValue] = useState('0');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [completedFlash, setCompletedFlash] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [showRemarks, setShowRemarks] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const selectedProduct = step.type === 'quantity' ? step : null;

  const handleInputChange = (val: string) => setInputValue(val);

  // Deselect by clicking same button again
  const handleSoybeanClick = (id: string) => {
    const p = soybeanProducts.find(x => x.id === id);
    if (!p) return;
    if (step.type === 'quantity' && step.productId === p.id) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    setStep({ type: 'quantity', productId: p.id, productName: p.fullName, productShortName: p.name, unit: 'kg', unitPrice: p.price, color: p.color });
    setInputValue('0');
  };

  const handleOtherClick = (id: string) => {
    const p = otherProducts.find(x => x.id === id);
    if (!p) return;
    if (step.type === 'quantity' && step.productId === p.id) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    setStep({ type: 'quantity', productId: p.id, productName: p.fullName, productShortName: p.name, unit: 'pcs', unitPrice: p.price, color: p.color });
    setInputValue('0');
  };

  const handlePlasticClick = () => {
    if (step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic')) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    setStep({ type: 'plastic_size' });
  };

  const handlePlasticSizeClick = (sizeId: string) => {
    const ps = plasticSizes.find(x => x.id === sizeId);
    if (!ps) return;
    setStep({ type: 'quantity', productId: 'plastic', productName: `Plastik ${ps.size}`, productShortName: 'P', unit: 'pcs', unitPrice: plasticBasePrice, color: PLASTIC_COLOR, plasticSize: ps.size });
    setInputValue('0');
  };

  const computedTotal = selectedProduct ? selectedProduct.unitPrice * (parseFloat(inputValue) || 0) : 0;

  const handleAddItem = () => {
    if (!selectedProduct || parseFloat(inputValue) <= 0) return;
    const qty = parseFloat(inputValue);
    const item: TransactionItem = {
      id: genId(),
      productId: selectedProduct.productId,
      productName: selectedProduct.productName,
      productShortName: selectedProduct.productShortName,
      quantity: qty, unit: selectedProduct.unit,
      unitPrice: selectedProduct.unitPrice,
      total: selectedProduct.unitPrice * qty,
      color: selectedProduct.color,
      plasticSize: selectedProduct.plasticSize,
    };
    setItems(prev => [...prev, item]);
    setStep({ type: 'idle' });
    setInputValue('0');
  };

  const handleComplete = () => {
    if (items.length === 0) return;
    addTransaction(items, remarks.trim() || undefined, selectedMember?.id, selectedMember?.name);
    setItems([]);
    setStep({ type: 'idle' });
    setInputValue('0');
    setRemarks('');
    setShowRemarks(false);
    setSelectedMember(null);
    setCompletedFlash(true);
    setTimeout(() => setCompletedFlash(false), 1500);
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(x => x.id !== id));
  const transactionTotal = items.reduce((s, i) => s + i.total, 0);

  const neuBtn = (color: string, active: boolean): React.CSSProperties => ({
    background: active ? color : '#eef0f5',
    boxShadow: active
      ? `3px 3px 8px rgba(0,0,0,0.16), -2px -2px 6px rgba(255,255,255,0.7)`
      : '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
    borderRadius: '11px',
    border: 'none',
    cursor: 'pointer',
    padding: '7px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    transition: 'all 0.15s',
    minWidth: 48,
    flex: 1,
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 14px 8px', gap: 9 }}>
      {showPriceEditor && <PriceEditorModal onClose={() => setShowPriceEditor(false)} />}
      {showMemberPicker && (
        <MemberPickerModal
          members={members}
          onSelect={m => setSelectedMember(m)}
          onClose={() => setShowMemberPicker(false)}
        />
      )}

      {/* TOP ZONE */}
      <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />

      {/* Keranjang */}
      <div style={{
        flex: 1, overflow: 'auto',
        background: '#eef0f5',
        boxShadow: 'inset 3px 3px 8px #c8cad1, inset -3px -3px 8px #ffffff',
        borderRadius: '14px',
        padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 0, minHeight: 60,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: items.length > 0 ? 7 : 0 }}>
          <span style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>
            KERANJANG{items.length > 0 ? ` (${items.length})` : ''}
          </span>
          {items.length > 0 && (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(transactionTotal)}</span>
          )}
        </div>

        {items.length === 0 && !completedFlash ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: '#c0c4d0' }}>Pilih produk & masukkan jumlah</span>
          </div>
        ) : completedFlash ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#52b96a' }}>Transaksi Berhasil!</span>
          </div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#2d3142', flex: 1 }}>
                  {item.productShortName}{item.plasticSize ? ` ${item.plasticSize}` : ''}
                </span>
                <span style={{ fontSize: '10px', color: '#7a7d96' }}>
                  {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)} {item.unit}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a4e69', minWidth: 72, textAlign: 'right' }}>
                  {formatRupiah(item.total)}
                </span>
                <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#e05a6a', cursor: 'pointer', padding: 2 }}>
                  <X size={11} />
                </button>
              </div>
            ))}
            {/* Remarks in cart */}
            {remarks && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 4, paddingTop: 5, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <MessageSquare size={10} color="#9a9db5" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: '#7a7d96', fontStyle: 'italic' }}>{remarks}</span>
              </div>
            )}
            {/* Member in cart */}
            {selectedMember && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, paddingTop: 5, borderTop: remarks ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                <User size={10} color="#4a90d9" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: '#4a90d9', fontWeight: 600 }}>{selectedMember.name}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* BOTTOM ZONE */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Calculator display */}
        <div style={{
          background: '#1a1d2e', borderRadius: '16px',
          padding: '10px 16px 12px',
          boxShadow: 'inset 5px 5px 12px #0d0f1a, inset -3px -3px 8px #2a2f48',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '16px', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3, position: 'relative' }}>
            <div>
              {selectedProduct ? (
                <>
                  <div style={{ fontSize: '9px', color: '#3a4060', letterSpacing: '0.1em', marginBottom: 1 }}>PRODUK</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: selectedProduct.color }}>
                    {selectedProduct.productName}{selectedProduct.plasticSize ? ` · ${selectedProduct.plasticSize}` : ''}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '10px', color: '#2e3550' }}>
                  {step.type === 'plastic_size' ? '← pilih ukuran' : 'pilih produk ↓'}
                </div>
              )}
            </div>
            {selectedProduct && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: '#3a4060', letterSpacing: '0.1em', marginBottom: 1 }}>TOTAL</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: computedTotal > 0 ? '#7ee8a2' : '#3a4060' }}>
                  {computedTotal > 0 ? formatRupiah(computedTotal) : '—'}
                </div>
              </div>
            )}
          </div>
          {/* Number display */}
          <div style={{
            fontFamily: "'Courier New', 'Courier', monospace",
            fontSize: '34px', fontWeight: 700, color: '#dde2f0',
            textAlign: 'right', letterSpacing: '0.06em', lineHeight: 1,
            display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1,
          }}>
            <span>{inputValue === '0' ? '' : inputValue}</span>
            <span style={{
              display: 'inline-block',
              color: selectedProduct ? '#7ee8a2' : '#2a3050',
              animation: 'cursor-blink 1s step-end infinite',
              fontSize: '30px', lineHeight: 1, marginBottom: '2px',
            }}>|</span>
          </div>
        </div>

        {/* Product Selection */}
        <div style={{ background: '#eef0f5', boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff', borderRadius: '16px', padding: '10px' }}>
          <div style={{ marginBottom: 7 }}>
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 5 }}>KEDELAI</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {soybeanProducts.map(p => {
                const isActive = step.type === 'quantity' && step.productId === p.id;
                return (
                  <button key={p.id} onClick={() => handleSoybeanClick(p.id)} style={neuBtn(p.color, isActive)}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#fff' : p.color }}>{p.name}</span>
                    <span style={{ fontSize: '8px', color: isActive ? 'rgba(255,255,255,0.75)' : '#9a9db5', whiteSpace: 'nowrap' }}>
                      {formatRupiah(p.price).replace('Rp ', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 5 }}>LAINNYA</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                onClick={handlePlasticClick}
                style={neuBtn(PLASTIC_COLOR, step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic'))}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: (step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic')) ? '#fff' : PLASTIC_COLOR }}>P</span>
                <span style={{ fontSize: '8px', color: '#9a9db5' }}>Plastik</span>
              </button>
              {otherProducts.map(p => {
                const isActive = step.type === 'quantity' && step.productId === p.id;
                return (
                  <button key={p.id} onClick={() => handleOtherClick(p.id)} style={neuBtn(p.color, isActive)}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#fff' : p.color }}>{p.name}</span>
                    <span style={{ fontSize: '8px', color: isActive ? 'rgba(255,255,255,0.75)' : '#9a9db5' }}>
                      {formatRupiah(p.price).replace('Rp ', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Plastic size grid */}
        {step.type === 'plastic_size' && (
          <div style={{ background: '#eef0f5', boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff', borderRadius: '14px', padding: '10px' }}>
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 7 }}>UKURAN PLASTIK</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {plasticSizes.map(ps => (
                <button key={ps.id} onClick={() => handlePlasticSizeClick(ps.id)} style={{ borderRadius: '9px', padding: '7px 4px', border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: PLASTIC_COLOR }}>{ps.size}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Remarks + Member trays */}
        <div style={{ display: 'flex', gap: 7 }}>
          {/* Remarks tray */}
          <div style={{
            flex: 1,
            background: '#eef0f5',
            boxShadow: showRemarks ? 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff' : '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
            borderRadius: '13px', overflow: 'hidden', transition: 'all 0.2s',
          }}>
            <button
              onClick={() => setShowRemarks(s => !s)}
              style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <MessageSquare size={12} color={remarks ? '#4a90d9' : '#9a9db5'} />
              <span style={{ fontSize: '10px', fontWeight: 600, color: remarks ? '#4a90d9' : '#9a9db5', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {remarks ? remarks : 'Catatan'}
              </span>
            </button>
            {showRemarks && (
              <div style={{ padding: '0 10px 9px' }}>
                <textarea
                  placeholder="Catatan khusus..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff',
                    borderRadius: '9px', border: 'none', outline: 'none',
                    padding: '8px 10px', fontSize: '12px', color: '#2d3142',
                    resize: 'none', lineHeight: 1.5, fontFamily: 'inherit',
                  }}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Member tray */}
          <button
            onClick={() => setShowMemberPicker(true)}
            style={{
              flexShrink: 0, padding: '9px 11px',
              background: '#eef0f5',
              boxShadow: selectedMember ? 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff' : '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
              borderRadius: '13px', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              minWidth: 64, transition: 'all 0.15s',
            }}
          >
            {selectedMember ? (
              <>
                <div style={{ width: 22, height: 22, borderRadius: '6px', background: `${getAvatarColor(selectedMember.id)}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: getAvatarColor(selectedMember.id) }}>{initials(selectedMember.name)}</span>
                </div>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#4a90d9', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedMember.name.split(' ')[0]}
                </span>
              </>
            ) : (
              <>
                <User size={14} color="#9a9db5" />
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5' }}>Pembeli</span>
              </>
            )}
          </button>
        </div>

        {/* Numpad */}
        <Numpad
          value={inputValue}
          onChange={handleInputChange}
          onAddItem={handleAddItem}
          onComplete={handleComplete}
          canAdd={step.type === 'quantity' && parseFloat(inputValue) > 0}
          canComplete={items.length > 0}
        />
      </div>

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
