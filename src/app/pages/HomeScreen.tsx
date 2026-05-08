import React, { useState } from 'react';
import { X, MessageSquare, User } from 'lucide-react';
import { useAppStore, formatRupiah, TransactionItem, Member } from '../store';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';
import { Numpad } from '../components/Numpad';
import { MemberPickerModal } from '../components/MemberPickerModal';

type Step =
  | { type: 'idle' }
  | { type: 'plastic_size' }
  | { type: 'quantity'; productId: string; productName: string; productShortName: string; unit: string; unitPrice: number; color: string; plasticSize?: string };

function genId() { return Math.random().toString(36).slice(2, 10); }

const PLASTIC_COLOR = '#38b2ac';

// Remarks modal
function RemarksModal({ value, onSave, onClose }: {
  value: string;
  onSave: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState(value);
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#eef0f5', borderRadius: '22px 22px 0 0',
          width: '100%', maxWidth: 430,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
          padding: '20px 16px 32px',
          animation: 'sheet-slide-up 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 2 }}>TAMBAH</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142', marginBottom: 14 }}>Catatan</div>
        <textarea
          placeholder="Catatan khusus..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#eef0f5', boxShadow: 'inset 2px 2px 6px #c8cad1, inset -2px -2px 6px #ffffff',
            borderRadius: '12px', border: 'none', outline: 'none',
            padding: '12px 14px', fontSize: '13px', color: '#2d3142',
            resize: 'none', lineHeight: 1.5, fontFamily: 'inherit',
            marginBottom: 12, display: 'block',
          }}
        />
        <button
          onClick={() => { onSave(draft.trim()); onClose(); }}
          style={{
            width: '100%', height: 48, borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: '#4a90d9',
            boxShadow: '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)',
            color: '#fff', fontWeight: 700, fontSize: '14px',
          }}
        >
          Simpan
        </button>
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
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [pressedIcon, setPressedIcon] = useState<string | null>(null);
  const [pressedRemove, setPressedRemove] = useState<string | null>(null);


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
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 14px 100px', gap: 12 }}>
      {showPriceEditor && <PriceEditorModal onClose={() => setShowPriceEditor(false)} />}
      {showRemarksModal && (
        <RemarksModal
          value={remarks}
          onSave={v => setRemarks(v)}
          onClose={() => setShowRemarksModal(false)}
        />
      )}
      {showMemberPicker && (
        <MemberPickerModal
          members={members}
          onSelect={m => setSelectedMember(m)}
          onClose={() => setShowMemberPicker(false)}
        />
      )}

      {/* TOP ZONE */}
      <div style={{ flexShrink: 0 }}>
        <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />
      </div>

      {/* Keranjang */}
      <div style={{
        flex: '1 1 auto', overflow: 'auto',
        background: '#eef0f5',
        boxShadow: 'inset 3px 3px 8px #c8cad1, inset -3px -3px 8px #ffffff',
        borderRadius: '14px',
        padding: '11px 13px',
        display: 'flex', flexDirection: 'column', gap: 0, minHeight: 60, maxHeight: 200,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 7 : 0 }}>
          <span style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>
            KERANJANG{items.length > 0 ? ` (${items.length})` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setShowRemarksModal(true)}
              onPointerDown={() => setPressedIcon('remarks')}
              onPointerUp={() => setPressedIcon(null)}
              onPointerLeave={() => setPressedIcon(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center' }}
            >
              <MessageSquare size={15} color={remarks ? '#4a90d9' : '#c0c4d0'} style={{ transform: pressedIcon === 'remarks' ? 'scale(0.75)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </button>
            <button
              onClick={() => setShowMemberPicker(true)}
              onPointerDown={() => setPressedIcon('member')}
              onPointerUp={() => setPressedIcon(null)}
              onPointerLeave={() => setPressedIcon(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center' }}
            >
              <User size={15} color={selectedMember ? '#4a90d9' : '#c0c4d0'} style={{ transform: pressedIcon === 'member' ? 'scale(0.75)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </button>
            {items.length > 0 && (
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142', marginLeft: 2 }}>{formatRupiah(transactionTotal)}</span>
            )}
          </div>
        </div>

        {items.length === 0 && !completedFlash ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: '#c0c4d0' }}>Pilih produk & masukkan jumlah</span>
          </div>
        ) : completedFlash ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'flash-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#52b96a' }}>Transaksi Berhasil!</span>
          </div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, animation: 'cart-item-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
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
                <button
                  onClick={() => removeItem(item.id)}
                  onPointerDown={() => setPressedRemove(item.id)}
                  onPointerUp={() => setPressedRemove(null)}
                  onPointerLeave={() => setPressedRemove(null)}
                  style={{ background: 'transparent', border: 'none', color: '#e05a6a', cursor: 'pointer', padding: 2 }}
                >
                  <X size={11} style={{ transform: pressedRemove === item.id ? 'scale(0.72)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)' }} />
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
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

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
                  <div style={{ fontSize: '9px', color: '#3a4060', letterSpacing: '0.1em', marginBottom: 1 }}>UNIT</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: selectedProduct.color }}>
                    {selectedProduct.unit}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '10px', color: '#2e3550' }}>
                  {step.type === 'plastic_size' ? '← pilih ukuran' : 'Unit: —'}
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
            fontFamily: 'var(--font-mono)',
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
        <div style={{ background: '#eef0f5', boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff', borderRadius: '16px', padding: '12px 12px 12px' }}>
          <div style={{ marginBottom: 9 }}>
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 7 }}>KEDELAI</div>
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
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 7 }}>LAINNYA</div>
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
          <div style={{ background: '#eef0f5', boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff', borderRadius: '14px', padding: '10px', animation: 'panel-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
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
        @keyframes cart-item-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes flash-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
