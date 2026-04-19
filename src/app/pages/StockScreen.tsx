import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAppStore, formatRupiah } from '../store';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';

function StatusIndicator({ quantity, low, critical }: { quantity: number; low: number; critical: number }) {
  if (quantity <= critical) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05a6a', boxShadow: '0 0 5px #e05a6a99' }} />
      <span style={{ fontSize: '9px', color: '#e05a6a', fontWeight: 700, letterSpacing: '0.05em' }}>KRITIS</span>
    </div>
  );
  if (quantity <= low) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f0a500', boxShadow: '0 0 5px #f0a50099' }} />
      <span style={{ fontSize: '9px', color: '#f0a500', fontWeight: 700, letterSpacing: '0.05em' }}>RENDAH</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52b96a', boxShadow: '0 0 5px #52b96a99' }} />
      <span style={{ fontSize: '9px', color: '#52b96a', fontWeight: 700, letterSpacing: '0.05em' }}>OK</span>
    </div>
  );
}

function StockBar({ quantity, low, critical, max }: { quantity: number; low: number; critical: number; max: number }) {
  const pct = Math.min(100, (quantity / Math.max(max, 1)) * 100);
  const color = quantity <= critical ? '#e05a6a' : quantity <= low ? '#f0a500' : '#52b96a';
  return (
    <div style={{
      height: 3, borderRadius: '2px',
      background: '#e0e3ec',
      boxShadow: 'inset 1px 1px 3px #c8cad1',
      overflow: 'hidden', marginTop: 8,
    }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: '2px', transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

interface AddStockModalProps {
  onClose: () => void;
}

function AddStockModal({ onClose }: AddStockModalProps) {
  const { stock, addStock } = useAppStore();
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    if (!selectedId || !amount) return;
    addStock(selectedId, parseFloat(amount));
    setAmount('');
    setSelectedId('');
    onClose();
  };

  const neuInput: React.CSSProperties = {
    background: '#eef0f5',
    boxShadow: 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff',
    borderRadius: '10px', border: 'none', outline: 'none',
    padding: '10px 14px', fontSize: '15px', color: '#2d3142', width: '100%',
  };

  const selectedItem = stock.find(s => s.productId === selectedId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#eef0f5',
          boxShadow: '8px 8px 20px #c8cad1, -8px -8px 20px #ffffff',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 430, padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.08em' }}>INVENTORI</div>
            <h3 style={{ margin: 0, color: '#2d3142' }}>Tambah Stok</h3>
          </div>
          <button onClick={onClose} style={{
            background: '#eef0f5', boxShadow: '4px 4px 8px #c8cad1, -4px -4px 8px #ffffff',
            border: 'none', borderRadius: '50%', width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={16} color="#6b7280" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5', marginBottom: 8, letterSpacing: '0.06em' }}>PILIH PRODUK</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {stock.map(s => (
                <button
                  key={s.productId}
                  onClick={() => setSelectedId(s.productId)}
                  style={{
                    padding: '7px 13px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: selectedId === s.productId
                      ? 'inset 3px 3px 6px #c8cad1, inset -3px -3px 6px #ffffff'
                      : '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff',
                    fontSize: '12px', fontWeight: 600,
                    color: selectedId === s.productId ? '#2d3142' : '#7a7d96',
                  }}
                >
                  {s.productName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5', marginBottom: 8, letterSpacing: '0.06em' }}>
              JUMLAH{selectedItem ? ` (${selectedItem.unit})` : ''}
            </div>
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={neuInput}
            />
          </div>

          {selectedItem && amount && (
            <div style={{
              background: '#eef0f5',
              boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff',
              borderRadius: '10px', padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', color: '#9a9db5' }}>Stok saat ini</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>
                {selectedItem.quantity} → <strong>{selectedItem.quantity + parseFloat(amount || '0')}</strong> {selectedItem.unit}
              </span>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!selectedId || !amount}
            style={{
              height: 50, borderRadius: '14px', border: 'none',
              cursor: selectedId && amount ? 'pointer' : 'default',
              background: selectedId && amount ? '#4a90d9' : '#c0c4d0',
              color: '#fff', fontWeight: 700, fontSize: '14px',
              boxShadow: selectedId && amount ? '4px 4px 10px rgba(74,144,217,0.35)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <Plus size={16} /> Tambah Stok
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StockScreen() {
  const { stock } = useAppStore();
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);

  const soybeanStock = stock.filter(s => s.type === 'soybean');
  const otherStock = stock.filter(s => s.type === 'other');

  const maxQty = (s: typeof stock[0]) => Math.max(s.quantity, s.lowThreshold * 2, 1);

  const criticalCount = stock.filter(s => s.quantity <= s.criticalThreshold).length;
  const lowCount = stock.filter(s => s.quantity > s.criticalThreshold && s.quantity <= s.lowThreshold).length;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 14px 8px', gap: 10 }}>
      {showPriceEditor && <PriceEditorModal onClose={() => setShowPriceEditor(false)} />}
      {showAddStock && <AddStockModal onClose={() => setShowAddStock(false)} />}

      <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.08em' }}>INVENTORI</div>
          <h2 style={{ margin: 0, color: '#2d3142' }}>Stok Barang</h2>
        </div>
        <button
          onClick={() => setShowAddStock(true)}
          style={{
            height: 38, padding: '0 14px', borderRadius: '11px', border: 'none', cursor: 'pointer',
            background: '#eef0f5', boxShadow: '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
            display: 'flex', alignItems: 'center', gap: 5, color: '#4a90d9', fontSize: '12px', fontWeight: 600,
          }}
        >
          <Plus size={14} /> Tambah Stok
        </button>
      </div>

      {/* Alert banner */}
      {(criticalCount > 0 || lowCount > 0) && (
        <div style={{
          borderRadius: '11px', padding: '9px 13px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: criticalCount > 0 ? '#fff1f2' : '#fffbeb',
          border: `1px solid ${criticalCount > 0 ? '#fecdd3' : '#fde68a'}`,
        }}>
          <span style={{ fontSize: '15px' }}>{criticalCount > 0 ? '🔴' : '🟡'}</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: criticalCount > 0 ? '#be123c' : '#92400e' }}>
              {criticalCount > 0 ? `${criticalCount} produk perlu restok segera` : `${lowCount} produk hampir habis`}
            </div>
            <div style={{ fontSize: '10px', color: '#9a9db5' }}>Gunakan tombol Tambah Stok</div>
          </div>
        </div>
      )}

      {/* Stock list */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Soybean */}
        <div style={{ fontSize: '9px', color: '#b0b4c8', letterSpacing: '0.08em', fontWeight: 600, paddingLeft: 2 }}>
          KEDELAI
        </div>
        {soybeanStock.map(s => (
          <StockCard key={s.productId} s={s} maxQty={maxQty(s)} />
        ))}

        {/* Others */}
        <div style={{ fontSize: '9px', color: '#b0b4c8', letterSpacing: '0.08em', fontWeight: 600, paddingLeft: 2, marginTop: 4 }}>
          LAINNYA
        </div>
        {otherStock.map(s => (
          <StockCard key={s.productId} s={s} maxQty={maxQty(s)} />
        ))}
      </div>
    </div>
  );
}

function StockCard({ s, maxQty }: { s: ReturnType<typeof useAppStore>['stock'][0]; maxQty: number }) {
  return (
    <div style={{
      background: '#eef0f5',
      boxShadow: '4px 4px 10px #c8cad1, -4px -4px 10px #ffffff',
      borderRadius: '14px',
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Neutral icon box — no color */}
        <div style={{
          width: 38, height: 38, borderRadius: '10px',
          background: '#eef0f5',
          boxShadow: 'inset 3px 3px 6px #c8cad1, inset -3px -3px 6px #ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#7a7d96' }}>
            {s.productName.slice(0, 2).toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            {/* Product name — neutral */}
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{s.productName}</span>
            {/* Quantity — neutral */}
            <div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#2d3142' }}>
                {s.quantity % 1 === 0 ? s.quantity : s.quantity.toFixed(1)}
              </span>
              <span style={{ fontSize: '10px', color: '#9a9db5', marginLeft: 3 }}>{s.unit}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            {/* Only the indicator is colored */}
            <StatusIndicator quantity={s.quantity} low={s.lowThreshold} critical={s.criticalThreshold} />
            <span style={{ fontSize: '9px', color: '#c0c4d0' }}>min {s.criticalThreshold} {s.unit}</span>
          </div>
        </div>
      </div>
      {/* Only the bar reflects status color */}
      <StockBar quantity={s.quantity} low={s.lowThreshold} critical={s.criticalThreshold} max={maxQty} />
    </div>
  );
}
