import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore, formatRupiah, TransactionItem } from '../store';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';
import { Numpad } from '../components/Numpad';

type Step =
  | { type: 'idle' }
  | { type: 'plastic_size' }
  | { type: 'quantity'; productId: string; productName: string; productShortName: string; unit: string; unitPrice: number; color: string; plasticSize?: string };

function genId() { return Math.random().toString(36).slice(2, 10); }

const PLASTIC_COLOR = '#38b2ac';

export default function HomeScreen() {
  const { soybeanProducts, plasticSizes, plasticBasePrice, otherProducts, addTransaction } = useAppStore();
  const [step, setStep] = useState<Step>({ type: 'idle' });
  const [inputValue, setInputValue] = useState('0');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [completedFlash, setCompletedFlash] = useState(false);

  const selectedProduct = step.type === 'quantity' ? step : null;

  const handleInputChange = (val: string) => {
    setInputValue(val);
  };

  const handleSoybeanClick = (id: string) => {
    const p = soybeanProducts.find(x => x.id === id);
    if (!p) return;
    setStep({ type: 'quantity', productId: p.id, productName: p.fullName, productShortName: p.name, unit: 'kg', unitPrice: p.price, color: p.color });
    setInputValue('0');
  };

  const handleOtherClick = (id: string) => {
    const p = otherProducts.find(x => x.id === id);
    if (!p) return;
    setStep({ type: 'quantity', productId: p.id, productName: p.fullName, productShortName: p.name, unit: 'pcs', unitPrice: p.price, color: p.color });
    setInputValue('0');
  };

  const handlePlasticClick = () => {
    setStep({ type: 'plastic_size' });
  };

  const handlePlasticSizeClick = (sizeId: string) => {
    const ps = plasticSizes.find(x => x.id === sizeId);
    if (!ps) return;
    setStep({
      type: 'quantity',
      productId: 'plastic',
      productName: `Plastik ${ps.size}`,
      productShortName: 'P',
      unit: 'pcs',
      unitPrice: plasticBasePrice,
      color: PLASTIC_COLOR,
      plasticSize: ps.size,
    });
    setInputValue('0');
  };

  const computedTotal = selectedProduct
    ? selectedProduct.unitPrice * (parseFloat(inputValue) || 0)
    : 0;

  const handleAddItem = () => {
    if (!selectedProduct || parseFloat(inputValue) <= 0) return;
    const qty = parseFloat(inputValue);
    const item: TransactionItem = {
      id: genId(),
      productId: selectedProduct.productId,
      productName: selectedProduct.productName,
      productShortName: selectedProduct.productShortName,
      quantity: qty,
      unit: selectedProduct.unit,
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
    addTransaction(items);
    setItems([]);
    setStep({ type: 'idle' });
    setInputValue('0');
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

      {/* ── TOP ZONE: ticker + cart ── */}
      <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />

      {/* Keranjang — always visible, scrollable, grows to fill space */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#eef0f5',
        boxShadow: 'inset 3px 3px 8px #c8cad1, inset -3px -3px 8px #ffffff',
        borderRadius: '14px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        minHeight: 60,
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
          items.map(item => (
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
          ))
        )}
      </div>

      {/* ── BOTTOM ZONE: display + products + numpad ── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Calculator display */}
        <div style={{
          background: '#1a1d2e',
          borderRadius: '16px',
          padding: '10px 16px 12px',
          boxShadow: 'inset 5px 5px 12px #0d0f1a, inset -3px -3px 8px #2a2f48',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Scanline overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '16px',
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
            pointerEvents: 'none',
          }} />

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

          {/* Number display with blinking cursor */}
          <div style={{
            fontFamily: "'Courier New', 'Courier', monospace",
            fontSize: '34px',
            fontWeight: 700,
            color: inputValue === '0' ? '#2a3050' : '#dde2f0',
            textAlign: 'right',
            letterSpacing: '0.06em',
            lineHeight: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'flex-end',
            gap: 1,
          }}>
            <span>{inputValue || '0'}</span>
            {step.type !== 'idle' && (
              <span style={{
                display: 'inline-block',
                color: selectedProduct ? '#7ee8a2' : '#3a4060',
                animation: 'cursor-blink 1s step-end infinite',
                fontSize: '30px',
                lineHeight: 1,
                marginBottom: '2px',
              }}>|</span>
            )}
          </div>
        </div>

        {/* Product Selection */}
        <div style={{
          background: '#eef0f5',
          boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff',
          borderRadius: '16px',
          padding: '10px',
        }}>
          {/* Soybean row */}
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

          {/* Other products row */}
          <div>
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 5 }}>LAINNYA</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                onClick={handlePlasticClick}
                style={neuBtn(PLASTIC_COLOR, step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic'))}
              >
                <span style={{
                  fontSize: '12px', fontWeight: 700,
                  color: (step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic')) ? '#fff' : PLASTIC_COLOR,
                }}>P</span>
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

        {/* Plastic size grid — compact */}
        {step.type === 'plastic_size' && (
          <div style={{
            background: '#eef0f5',
            boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff',
            borderRadius: '14px',
            padding: '10px',
          }}>
            <div style={{ fontSize: '8px', color: '#b8bbd0', letterSpacing: '0.06em', marginBottom: 7 }}>UKURAN PLASTIK</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {plasticSizes.map(ps => (
                <button
                  key={ps.id}
                  onClick={() => handlePlasticSizeClick(ps.id)}
                  style={{
                    borderRadius: '9px', padding: '7px 4px', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
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
      `}</style>
    </div>
  );
}
