import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAppStore, formatRupiah, StockAddition } from '../store';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';

// ─────────── Helpers ───────────
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─────────── Status & Bar ───────────
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
    <div style={{ height: 3, borderRadius: '2px', background: '#e0e3ec', boxShadow: 'inset 1px 1px 3px #c8cad1', overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ─────────── Mini Calendar ───────────
function StockCalendar({
  selectedDate, onSelect, onClose,
  additionDates,
}: {
  selectedDate: Date | null;
  onSelect: (d: Date | null) => void;
  onClose: () => void;
  additionDates: Date[];
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const hasDot = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return additionDates.some(ad => isSameDay(ad, d));
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  return (
    <div style={{
      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
      marginTop: 6, zIndex: 100,
      background: '#eef0f5',
      borderRadius: '18px',
      boxShadow: '6px 6px 18px #c0c3ca, -4px -4px 12px rgba(255,255,255,0.8)',
      padding: '14px', width: 280,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5' }}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5' }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: '#b0b4c8', fontWeight: 700, padding: '2px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const cellDate = new Date(viewYear, viewMonth, day);
          const isSelected = selectedDate && isSameDay(cellDate, selectedDate);
          const isToday = isSameDay(cellDate, today);
          const dot = hasDot(day);
          return (
            <button key={i}
              onClick={() => { onSelect(isSelected ? null : cellDate); onClose(); }}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: isSelected || isToday ? 700 : 400,
                background: isSelected ? '#4a90d9' : '#eef0f5',
                color: isSelected ? '#fff' : isToday ? '#4a90d9' : '#2d3142',
                boxShadow: isSelected ? '2px 2px 5px rgba(74,144,217,0.4)' : '2px 2px 4px #c8cad1, -2px -2px 4px rgba(255,255,255,0.8)',
                position: 'relative', transition: 'all 0.12s',
              }}
            >
              {day}
              {dot && (
                <span style={{
                  position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: isSelected ? 'rgba(255,255,255,0.8)' : '#e05a6a',
                  display: 'block',
                }} />
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {selectedDate && (
          <button onClick={() => { onSelect(null); onClose(); }} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: '#eef0f5', boxShadow: '2px 2px 5px #c8cad1, -2px -2px 5px rgba(255,255,255,0.8)',
            fontSize: '11px', fontWeight: 600, color: '#9a9db5',
          }}>Semua</button>
        )}
        <button onClick={() => { onSelect(today); onClose(); }} style={{
          flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: '#eef0f5', boxShadow: '2px 2px 5px #c8cad1, -2px -2px 5px rgba(255,255,255,0.8)',
          fontSize: '11px', fontWeight: 600, color: '#4a90d9',
        }}>Hari Ini</button>
      </div>
    </div>
  );
}

// ─────────── Date Navigator for Additions ───────────
function AdditionDateNav({
  selectedDate, onChange, additionDates,
}: {
  selectedDate: Date | null;
  onChange: (d: Date | null) => void;
  additionDates: Date[];
}) {
  const [calOpen, setCalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setCalOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpen]);

  const today = new Date();

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>RIWAYAT TAMBAH STOK</div>
      <button
        onClick={() => setCalOpen(o => !o)}
        style={{
          marginLeft: 'auto',
          background: '#eef0f5',
          boxShadow: calOpen || selectedDate
            ? 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff'
            : '3px 3px 7px #c8cad1, -2px -2px 5px rgba(255,255,255,0.8)',
          border: 'none', borderRadius: '9px', cursor: 'pointer',
          padding: '5px 10px',
          fontSize: '11px', fontWeight: 600,
          color: selectedDate ? '#4a90d9' : '#9a9db5',
          display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
        }}
      >
        <Calendar size={12} />
        {selectedDate
          ? `${MONTHS[selectedDate.getMonth()].slice(0,3)} ${selectedDate.getDate()}`
          : 'Pilih Tanggal'}
      </button>

      {calOpen && (
        <StockCalendar
          selectedDate={selectedDate}
          onSelect={onChange}
          onClose={() => setCalOpen(false)}
          additionDates={additionDates}
        />
      )}
    </div>
  );
}

// ─────────── Add Stock Modal ───────────
function AddStockModal({ onClose }: { onClose: () => void }) {
  const { stock, addStock } = useAppStore();
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');

  const selectedItem = stock.find(s => s.productId === selectedId);

  const handleAdd = () => {
    if (!selectedId || !amount || !selectedItem) return;
    addStock(selectedId, parseFloat(amount), selectedItem.productName, selectedItem.unit);
    setAmount('');
    setSelectedId('');
    onClose();
  };

  const neuInput: React.CSSProperties = {
    background: '#eef0f5',
    boxShadow: 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff',
    borderRadius: '10px', border: 'none', outline: 'none',
    padding: '10px 14px', fontSize: '15px', color: '#2d3142', width: '100%',
    boxSizing: 'border-box' as const,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#eef0f5', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.08em' }}>INVENTORI</div>
            <h3 style={{ margin: 0, color: '#2d3142' }}>Tambah Stok</h3>
          </div>
          <button onClick={onClose} style={{ background: '#eef0f5', boxShadow: '3px 3px 7px #c8cad1, -2px -2px 5px rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color="#6b7280" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5', marginBottom: 8, letterSpacing: '0.06em' }}>PILIH PRODUK</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {stock.map(s => (
                <button key={s.productId} onClick={() => setSelectedId(s.productId)} style={{
                  padding: '7px 13px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: '#eef0f5',
                  boxShadow: selectedId === s.productId
                    ? 'inset 3px 3px 6px #c8cad1, inset -3px -3px 6px #ffffff'
                    : '3px 3px 7px #c8cad1, -2px -2px 5px rgba(255,255,255,0.8)',
                  fontSize: '12px', fontWeight: 600,
                  color: selectedId === s.productId ? '#2d3142' : '#7a7d96',
                }}>
                  {s.productName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: '#9a9db5', marginBottom: 8, letterSpacing: '0.06em' }}>
              JUMLAH{selectedItem ? ` (${selectedItem.unit})` : ''}
            </div>
            <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} style={neuInput} />
          </div>

          {selectedItem && amount && (
            <div style={{ background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#9a9db5' }}>Stok saat ini</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>
                {selectedItem.quantity} → <strong>{selectedItem.quantity + parseFloat(amount || '0')}</strong> {selectedItem.unit}
              </span>
            </div>
          )}

          <button onClick={handleAdd} disabled={!selectedId || !amount} style={{
            height: 50, borderRadius: '14px', border: 'none', cursor: selectedId && amount ? 'pointer' : 'default',
            background: selectedId && amount ? '#4a90d9' : '#c0c4d0',
            color: '#fff', fontWeight: 700, fontSize: '14px',
            boxShadow: selectedId && amount ? '4px 4px 10px rgba(74,144,217,0.35)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
          }}>
            <Plus size={16} /> Tambah Stok
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────── Stock Card ───────────
function StockCard({ s, maxQty }: { s: ReturnType<typeof useAppStore>['stock'][0]; maxQty: number }) {
  return (
    <div style={{
      background: '#eef0f5',
      boxShadow: '3px 3px 8px #caccd4, -2px -2px 6px rgba(255,255,255,0.75)',
      borderRadius: '14px', padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '10px', background: '#eef0f5', boxShadow: 'inset 3px 3px 6px #c8cad1, inset -3px -3px 6px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#7a7d96' }}>{s.productName.slice(0, 2).toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{s.productName}</span>
            <div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#2d3142' }}>
                {s.quantity % 1 === 0 ? s.quantity : s.quantity.toFixed(1)}
              </span>
              <span style={{ fontSize: '10px', color: '#9a9db5', marginLeft: 3 }}>{s.unit}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <StatusIndicator quantity={s.quantity} low={s.lowThreshold} critical={s.criticalThreshold} />
            <span style={{ fontSize: '9px', color: '#c0c4d0' }}>min {s.criticalThreshold} {s.unit}</span>
          </div>
        </div>
      </div>
      <StockBar quantity={s.quantity} low={s.lowThreshold} critical={s.criticalThreshold} max={maxQty} />
    </div>
  );
}

// ─────────── Addition Entry ───────────
function AdditionEntry({ entry }: { entry: StockAddition }) {
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(entry.timestamp);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a90d9', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{entry.productName}</span>
      <span style={{ fontSize: '11px', color: '#52b96a', fontWeight: 700 }}>+{entry.quantity} {entry.unit}</span>
      <span style={{ fontSize: '10px', color: '#b0b4c8', minWidth: 36 }}>{time}</span>
    </div>
  );
}

// ─────────── Main Screen ───────────
export default function StockScreen() {
  const { stock, stockAdditions } = useAppStore();
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [historyDate, setHistoryDate] = useState<Date | null>(null);

  const soybeanStock = stock.filter(s => s.type === 'soybean');
  const otherStock = stock.filter(s => s.type === 'other');
  const maxQty = (s: typeof stock[0]) => Math.max(s.quantity, s.lowThreshold * 2, 1);

  const criticalCount = stock.filter(s => s.quantity <= s.criticalThreshold).length;
  const lowCount = stock.filter(s => s.quantity > s.criticalThreshold && s.quantity <= s.lowThreshold).length;

  // All unique addition dates for dots
  const additionDates = useMemo(() => stockAdditions.map(a => a.timestamp), [stockAdditions]);

  // Filtered additions for selected date
  const filteredAdditions = useMemo(() => {
    if (!historyDate) return stockAdditions.slice().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 20);
    return stockAdditions
      .filter(a => isSameDay(a.timestamp, historyDate))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [stockAdditions, historyDate]);

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
        <button onClick={() => setShowAddStock(true)} style={{
          height: 38, padding: '0 14px', borderRadius: '11px', border: 'none', cursor: 'pointer',
          background: '#eef0f5',
          boxShadow: '3px 3px 8px #caccd4, -2px -2px 6px rgba(255,255,255,0.75)',
          display: 'flex', alignItems: 'center', gap: 5, color: '#4a90d9', fontSize: '12px', fontWeight: 600,
        }}>
          <Plus size={14} /> Tambah Stok
        </button>
      </div>

      {/* Alert */}
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

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Stock list */}
        <div style={{ fontSize: '9px', color: '#b0b4c8', letterSpacing: '0.08em', fontWeight: 600, paddingLeft: 2 }}>KEDELAI</div>
        {soybeanStock.map(s => <StockCard key={s.productId} s={s} maxQty={maxQty(s)} />)}

        <div style={{ fontSize: '9px', color: '#b0b4c8', letterSpacing: '0.08em', fontWeight: 600, paddingLeft: 2, marginTop: 4 }}>LAINNYA</div>
        {otherStock.map(s => <StockCard key={s.productId} s={s} maxQty={maxQty(s)} />)}

        {/* ── History section ── */}
        <div style={{ marginTop: 6, background: '#eef0f5', boxShadow: '3px 3px 8px #caccd4, -2px -2px 6px rgba(255,255,255,0.75)', borderRadius: '14px', padding: '12px 14px' }}>
          <div style={{ position: 'relative' }}>
            <AdditionDateNav
              selectedDate={historyDate}
              onChange={setHistoryDate}
              additionDates={additionDates}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            {filteredAdditions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#b0b4c8', fontSize: '12px' }}>
                {historyDate ? 'Tidak ada penambahan pada tanggal ini' : 'Belum ada riwayat'}
              </div>
            ) : (
              <>
                {historyDate && (
                  <div style={{ fontSize: '10px', color: '#9a9db5', marginBottom: 6 }}>
                    {MONTHS[historyDate.getMonth()]} {historyDate.getDate()}, {historyDate.getFullYear()} · {filteredAdditions.length} entri
                  </div>
                )}
                {filteredAdditions.map(entry => <AdditionEntry key={entry.id} entry={entry} />)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
