import { useState, useRef, useEffect, useMemo } from 'react';
import { tap, confirmTap } from '../../utils/haptics';
import { Plus, X, ChevronLeft, ChevronRight, ChevronDown, Calendar, FileSpreadsheet, Check, Pencil } from 'lucide-react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';

const SHD_RAISED_STD  = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RAISED_LIST = '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92)';
const SHD_RECESSED    = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';
const SHD_ACTION_PRESS  = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)';
const SHD_CALENDAR      = '8px 8px 18px #c0c3ca, -6px -6px 14px #ffffff';

interface StockRow {
  id: Id<'stock'>;
  productId: Id<'products'>;
  variantId?: Id<'productVariants'>;
  productName: string;
  productShortName: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  color: string;
}

interface AdditionResult {
  additionId: Id<'stockAdditions'>;
  productName: string;
  quantity: number;
  unit: string;
}

interface AdditionRow {
  id: Id<'stockAdditions'>;
  productName: string;
  quantity: number;
  unit: string;
  timestamp: Date;
}

interface CorrectionRow {
  id: Id<'stockCorrections'>;
  productName: string;
  delta: number;
  unit: string;
  timestamp: Date;
}

type HistoryRow = ({ kind: 'addition' } & AdditionRow) | ({ kind: 'correction' } & CorrectionRow);

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const MONTHS     = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_SHORT = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

// ─────────── Status & Bar ───────────
function StatusIndicator({ quantity, low, critical }: { quantity: number; low: number; critical: number }) {
  if (quantity <= critical) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4183d', boxShadow: '0 0 5px #d4183d99' }} />
      <span style={{ fontSize: '9px', color: '#d4183d', fontWeight: 700, letterSpacing: '0.05em' }}>KRITIS</span>
    </div>
  );
  if (quantity <= low) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4a017', boxShadow: '0 0 5px #d4a01799' }} />
      <span style={{ fontSize: '9px', color: '#d4a017', fontWeight: 700, letterSpacing: '0.05em' }}>RENDAH</span>
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
  const pct   = Math.min(1, quantity / Math.max(max, 1));
  const color = quantity <= critical ? '#d4183d' : quantity <= low ? '#d4a017' : '#52b96a';
  return (
    <div style={{ height: 3, borderRadius: '2px', background: '#e0e3ec', boxShadow: 'inset 1px 1px 3px #c8cad1', marginTop: 8 }}>
      <div style={{ height: '100%', width: '100%', background: color, borderRadius: '2px', transform: `scaleX(${pct})`, transformOrigin: 'left center', transition: 'transform 0.6s ease' }} />
    </div>
  );
}

// ─────────── Mini Calendar ───────────
function StockCalendar({
  selectedDate, onSelect, onClose, additionDates,
}: {
  selectedDate: Date | null;
  onSelect: (d: Date | null) => void;
  onClose: () => void;
  additionDates: Date[];
}) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
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
    <div
      style={{
        position: 'fixed', left: 0, right: 0,
        top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)',
        zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px',
      }}
      onClick={onClose}
    >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#eef0f5', borderRadius: '20px',
        padding: '16px', width: '100%', maxWidth: 300,
        animation: 'cal-modal-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5' }}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5' }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: '#c0c4d0', fontWeight: 700, padding: '2px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const cellDate  = new Date(viewYear, viewMonth, day);
          const isSelected = selectedDate && isSameDay(cellDate, selectedDate);
          const isToday   = isSameDay(cellDate, today);
          const dot       = hasDot(day);
          return (
            <button key={i}
              onClick={() => { onSelect(isSelected ? null : cellDate); onClose(); }}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: isSelected || isToday ? 700 : 400,
                background: isSelected ? '#4a90d9' : '#eef0f5',
                color: isSelected ? '#fff' : isToday ? '#4a90d9' : '#2d3142',
                boxShadow: isSelected ? '2px 2px 5px rgba(74,144,217,0.4)' : '2px 2px 4px #c8cad1, -2px -2px 4px rgba(255,255,255,0.8)',
                position: 'relative', transition: 'box-shadow 0.12s, background-color 0.12s, color 0.12s',
              }}
            >
              {day}
              {dot && (
                <span style={{
                  position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: isSelected ? 'rgba(255,255,255,0.8)' : '#4a90d9',
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
            background: '#eef0f5', boxShadow: SHD_RAISED_STD,
            fontSize: '11px', fontWeight: 600, color: '#9a9db5',
          }}>Semua</button>
        )}
        <button onClick={() => { onSelect(today); onClose(); }} style={{
          flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: '#eef0f5', boxShadow: SHD_RAISED_STD,
          fontSize: '11px', fontWeight: 600, color: '#4a90d9',
        }}>Hari Ini</button>
      </div>
    </div>
    </div>
  );
}

// ─────────── Date Navigator for Additions ───────────
function AdditionDateNav({
  selectedDate, calOpen, onToggleCal,
}: {
  selectedDate: Date | null;
  calOpen: boolean;
  onToggleCal: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Riwayat Tambah Stok</div>
      <button
        onClick={onToggleCal}
        style={{
          marginLeft: 'auto',
          background: '#eef0f5',
          boxShadow: calOpen || selectedDate ? SHD_RECESSED : SHD_RAISED_STD,
          border: 'none', borderRadius: '9px', cursor: 'pointer',
          padding: '5px 10px',
          fontSize: '11px', fontWeight: 600,
          color: selectedDate ? '#4a90d9' : '#9a9db5',
          display: 'flex', alignItems: 'center', gap: 5, transition: 'box-shadow 0.15s',
        }}
      >
        <Calendar size={12} />
        {selectedDate
          ? `${MONTHS[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getDate()}`
          : 'Pilih Tanggal'}
      </button>
    </div>
  );
}

// ─────────── Undo Toast ───────────
const UNDO_TOAST_MS = 10_000;

function UndoToast({ result, startedAt, onUndo }: { result: AdditionResult; startedAt: number; onUndo: () => void }) {
  const DURATION = UNDO_TOAST_MS;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  const progress = Math.max(0, 1 - (Date.now() - startedAt) / DURATION);
  const qty = result.quantity % 1 === 0 ? result.quantity : result.quantity.toFixed(1);

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 0, right: 0,
      width: 'calc(100% - 28px)', maxWidth: 402, margin: '0 auto', zIndex: 200,
      background: '#eef0f5', borderRadius: '16px',
      boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff',
      padding: '12px 14px',
      animation: 'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#2d3142' }}>
            +{qty} {result.unit} {result.productName}
          </div>
          <div style={{ fontSize: '10px', color: '#9a9db5', marginTop: 1 }}>Stok berhasil ditambahkan</div>
        </div>
        <button onClick={onUndo} style={{
          background: '#eef0f5', boxShadow: SHD_RAISED_STD,
          border: 'none', borderRadius: '9px', cursor: 'pointer',
          padding: '6px 12px', fontSize: '11px', fontWeight: 700,
          color: '#4a90d9', flexShrink: 0, transition: 'box-shadow 0.12s',
        }}>Batalkan</button>
      </div>
      <div style={{ height: 2, background: '#e0e3ec', borderRadius: 1, marginTop: 10 }}>
        <div style={{
          height: '100%', width: '100%', background: '#4a90d9', borderRadius: 1,
          transform: `scaleX(${progress})`, transformOrigin: 'left center',
          transition: 'transform 100ms linear',
        }} />
      </div>
    </div>
  );
}

// ─────────── Add Stock Modal ───────────
function AddStockModal({
  stockItems,
  onClose,
  onAdded,
}: {
  stockItems: StockRow[];
  onClose: () => void;
  onAdded: (result: AdditionResult) => void;
}) {
  const addStockMutation = useMutation(api.stock.addStock);
  const [selectedId, setSelectedId] = useState<Id<'stock'> | ''>('');
  const [amount, setAmount]         = useState('');
  const [addPressed, setAddPressed] = useState(false);

  const nonPlasticItems = stockItems.filter(s => !s.variantId);
  const plasticItems    = stockItems
    .filter(s => !!s.variantId)
    .sort((a, b) => {
      const parse = (name: string) => {
        const m = name.replace(/^Plastik\s*/i, '').match(/(\d+)[×xX](\d+)/);
        return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0];
      };
      const [a1, a2] = parse(a.productName);
      const [b1, b2] = parse(b.productName);
      return a1 !== b1 ? a1 - b1 : a2 - b2;
    });
  const selectedIsPlastic = selectedId ? !!stockItems.find(s => s.id === selectedId)?.variantId : false;

  const selectedItem    = stockItems.find(s => s.id === selectedId);
  const parsedAmount    = parseFloat(amount);
  const canAdd          = !!(selectedId && amount && parsedAmount > 0);
  const isLargeQuantity = !!(selectedItem && canAdd && parsedAmount > selectedItem.minThreshold * 5);

  const handleAdd = async () => {
    if (!canAdd || !selectedItem) return;
    try {
      const additionId = await addStockMutation({
        stockId: selectedId as Id<'stock'>,
        quantity: parsedAmount,
      });
      setAmount('');
      setSelectedId('');
      onAdded({
        additionId,
        productName: selectedItem.productName,
        quantity: parsedAmount,
        unit: selectedItem.unit,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed z-50 flex items-end justify-center" style={{ left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#eef0f5', boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
        borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, maxHeight: 'calc(var(--app-visual-height) - 16px)', overflow: 'auto', padding: '20px',
        animation: 'sheet-slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inventori</div>
            <h3 style={{ margin: '2px 0 0', color: '#2d3142', fontSize: '18px', fontWeight: 700 }}>Tambah Stok</h3>
          </div>
          <button onClick={onClose} style={{
            background: '#eef0f5', boxShadow: SHD_RAISED_STD,
            border: 'none', borderRadius: '50%', width: 44, height: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={16} color="#9a9db5" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pilih Produk</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {nonPlasticItems.map(s => (
                  <button key={s.id} onClick={() => setSelectedId(s.id)} style={{
                    padding: '7px 13px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: selectedId === s.id ? SHD_RECESSED : SHD_RAISED_STD,
                    fontSize: '12px', fontWeight: 600,
                    color: selectedId === s.id ? '#2d3142' : '#9a9db5',
                    transition: 'box-shadow 0.12s',
                  }}>
                    {s.productName}
                  </button>
                ))}
              </div>
              {plasticItems.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedIsPlastic ? String(selectedId) : ''}
                    onChange={e => setSelectedId(e.target.value ? e.target.value as Id<'stock'> : '')}
                    style={{
                      width: '100%', appearance: 'none', WebkitAppearance: 'none',
                      background: '#eef0f5',
                      boxShadow: selectedIsPlastic ? SHD_RECESSED : SHD_RAISED_STD,
                      borderRadius: '10px', border: 'none', outline: 'none',
                      padding: '9px 36px 9px 13px',
                      fontSize: '12px', fontWeight: 600,
                      color: selectedIsPlastic ? '#2d3142' : '#9a9db5',
                      cursor: 'pointer', transition: 'box-shadow 0.12s',
                    }}
                  >
                    <option value="">Plastik ···</option>
                    {plasticItems.map(s => (
                      <option key={s.id} value={String(s.id)}>
                        {s.productName.replace(/^Plastik\s+/i, '')}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} color={selectedIsPlastic ? '#2d3142' : '#9a9db5'}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Jumlah{selectedItem ? ` (${selectedItem.unit})` : ''}
            </div>
            <input
              type="number" placeholder="0" min="0.01" step="any" value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              style={{
                background: '#eef0f5', boxShadow: SHD_RECESSED,
                borderRadius: '10px', border: 'none', outline: 'none',
                padding: '10px 14px', fontSize: '15px', color: '#2d3142', width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {selectedItem && amount && parsedAmount > 0 && (
            <div style={{
              background: '#eef0f5', boxShadow: SHD_RECESSED,
              borderRadius: '10px', padding: '10px 14px',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', color: '#9a9db5' }}>Stok saat ini</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>
                {selectedItem.quantity} → <strong>{selectedItem.quantity + parsedAmount}</strong> {selectedItem.unit}
              </span>
            </div>
          )}

          {isLargeQuantity && (
            <div style={{
              background: '#eef0f5',
              boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px rgba(255,255,255,0.9)',
              borderRadius: '10px', padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4a017', boxShadow: '0 0 4px #d4a01799', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#d4a017', fontWeight: 600 }}>Jumlah besar. Pastikan sudah benar.</span>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            onPointerDown={() => { if (canAdd) { tap(); setAddPressed(true); } }}
            onPointerUp={() => setAddPressed(false)}
            onPointerLeave={() => setAddPressed(false)}
            style={{
              height: 50, borderRadius: '14px', border: 'none',
              cursor: canAdd ? 'pointer' : 'default',
              background: canAdd ? '#4a90d9' : '#a8acbe',
              opacity: canAdd ? 1 : 0.55,
              color: '#fff', fontWeight: 700, fontSize: '14px',
              boxShadow: !canAdd ? 'none' : addPressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
              transform: addPressed && canAdd ? 'scale(0.97)' : 'scale(1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow 0.07s, transform 0.07s, opacity 0.15s',
            }}
          >
            <Plus size={16} /> Tambah Stok
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────── Set Quantity Modal ───────────
function SetQuantityModal({ s, onClose, onConfirm }: { s: StockRow; onClose: () => void; onConfirm: (qty: number) => void }) {
  const [val, setVal] = useState(s.quantity % 1 === 0 ? String(s.quantity) : s.quantity.toFixed(2));
  const [confirmPressed, setConfirmPressed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 80);
  }, []);

  const parsed  = parseFloat(val);
  const canSave = !isNaN(parsed) && parsed >= 0;
  const diff    = canSave ? parsed - s.quantity : null;

  return (
    <div
      className="fixed z-50 flex items-end justify-center"
      style={{ left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#eef0f5', boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
          borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430,
          padding: '20px 20px 32px',
          animation: 'sheet-slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Koreksi Stok</div>
            <h3 style={{ margin: '2px 0 0', color: '#2d3142', fontSize: '17px', fontWeight: 700 }}>{s.productName}</h3>
          </div>
          <button onClick={onClose} style={{ background: '#eef0f5', boxShadow: SHD_RAISED_STD, border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={16} color="#9a9db5" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Current → new preview */}
          <div style={{ background: '#eef0f5', boxShadow: SHD_RECESSED, borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#9a9db5' }}>Saat ini</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142' }}>
              {s.quantity % 1 === 0 ? s.quantity : s.quantity.toFixed(1)} {s.unit}
            </span>
          </div>

          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Jumlah Baru ({s.unit})
            </div>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) { onConfirm(parsed); onClose(); } if (e.key === 'Escape') onClose(); }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#eef0f5', boxShadow: SHD_RECESSED,
                borderRadius: '10px', border: 'none', outline: 'none',
                padding: '11px 14px', fontSize: '22px', fontWeight: 700, color: '#2d3142',
              }}
            />
          </div>

          {canSave && diff !== null && diff !== 0 && (
            <div style={{ background: '#eef0f5', boxShadow: SHD_RECESSED, borderRadius: '10px', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#9a9db5' }}>Perubahan</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: diff > 0 ? '#52b96a' : '#d4183d' }}>
                {diff > 0 ? '+' : ''}{diff % 1 === 0 ? diff : diff.toFixed(1)} {s.unit}
              </span>
            </div>
          )}

          <button
            disabled={!canSave}
            onPointerDown={() => { if (canSave) { confirmTap(); setConfirmPressed(true); } }}
            onPointerUp={() => setConfirmPressed(false)}
            onPointerLeave={() => setConfirmPressed(false)}
            onClick={() => { if (canSave) { onConfirm(parsed); onClose(); } }}
            style={{
              height: 50, borderRadius: '14px', border: 'none',
              cursor: canSave ? 'pointer' : 'default',
              background: canSave ? '#4a90d9' : '#a8acbe',
              opacity: canSave ? 1 : 0.55,
              color: '#fff', fontWeight: 700, fontSize: '14px',
              boxShadow: !canSave ? 'none' : confirmPressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
              transform: confirmPressed && canSave ? 'scale(0.97)' : 'scale(1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow 0.07s, transform 0.07s, opacity 0.15s',
            }}
          >
            <Check size={16} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────── Stock Card ───────────
function StockCard({ s, maxQty, onEdit }: { s: StockRow; maxQty: number; onEdit: (s: StockRow) => void }) {
  const critical = s.minThreshold;
  const low      = s.minThreshold * 3;

  return (
    <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED_LIST, borderRadius: '14px', padding: '12px 14px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '10px', background: '#eef0f5', boxShadow: SHD_RECESSED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: s.color }}>{s.productShortName.slice(0, 2).toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>{s.productName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#2d3142' }}>
                {s.quantity % 1 === 0 ? s.quantity : s.quantity.toFixed(1)}
              </span>
              <button onClick={() => onEdit(s)} aria-label="Edit kuantitas" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 2px', display: 'flex', alignItems: 'center' }}>
                <Pencil size={11} color="#c0c4d0" />
              </button>
              <span style={{ fontSize: '10px', color: '#9a9db5', marginLeft: 1 }}>{s.unit}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <StatusIndicator quantity={s.quantity} low={low} critical={critical} />
            <span style={{ fontSize: '9px', color: '#c0c4d0' }}>min {critical} {s.unit}</span>
          </div>
        </div>
      </div>
      <StockBar quantity={s.quantity} low={low} critical={critical} max={maxQty} />
    </div>
  );
}

// ─────────── Plastic Sub-Row ───────────
function PlasticSubRow({ s, isLast, onEdit }: { s: StockRow; isLast: boolean; onEdit: (s: StockRow) => void }) {
  const sizeName = s.productName.replace(/^Plastik\s+/i, '');
  const dotColor = s.quantity <= s.minThreshold ? '#d4183d' : s.quantity <= s.minThreshold * 3 ? '#d4a017' : '#52b96a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid #eaecf2' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{sizeName}</span>
      <span style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142' }}>{s.quantity}</span>
      <button onClick={e => { e.stopPropagation(); onEdit(s); }} aria-label="Edit kuantitas" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 2px', display: 'flex', alignItems: 'center' }}>
        <Pencil size={10} color="#c0c4d0" />
      </button>
      <span style={{ fontSize: '10px', color: '#9a9db5', minWidth: 20 }}>pcs</span>
    </div>
  );
}

// ─────────── Plastic Group Card ───────────
function PlasticGroupCard({ items, onEdit }: { items: StockRow[]; onEdit: (s: StockRow) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [alertIdx, setAlertIdx] = useState(0);
  const [flash, setFlash] = useState(true);

  const totalQty   = items.reduce((sum, s) => sum + s.quantity, 0);
  const color      = items[0]?.color ?? '#38b2ac';
  const anyCritical = items.some(s => s.quantity <= s.minThreshold);
  const anyLow      = items.some(s => s.quantity > s.minThreshold && s.quantity <= s.minThreshold * 3);
  const totalCritical = items.reduce((sum, s) => sum + s.minThreshold, 0);
  const totalLow      = items.reduce((sum, s) => sum + s.minThreshold * 3, 0);
  const maxQty     = Math.max(totalQty, totalLow, 1);

  const statusColor = anyCritical ? '#d4183d' : anyLow ? '#d4a017' : '#52b96a';
  const statusLabel = anyCritical ? 'KRITIS'  : anyLow ? 'RENDAH'  : 'OK';

  const alertItems = items.filter(s => s.quantity <= s.minThreshold * 3);
  const currentAlert = alertItems.length > 0 ? alertItems[alertIdx % alertItems.length] : null;
  const alertSize = currentAlert?.productName.replace(/^Plastik\s*/i, '') ?? '';

  useEffect(() => {
    if (alertItems.length <= 1) return;
    const id = setInterval(() => {
      setFlash(false);
      setTimeout(() => {
        setAlertIdx(i => i + 1);
        setFlash(true);
      }, 180);
    }, 1800);
    return () => clearInterval(id);
  }, [alertItems.length]);

  return (
    <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED_LIST, borderRadius: '14px', flexShrink: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '10px', background: '#eef0f5',
            boxShadow: SHD_RECESSED,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color }}>P</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>Plastik</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#2d3142' }}>{totalQty}</span>
                  <span style={{ fontSize: '10px', color: '#9a9db5', marginLeft: 3 }}>pcs</span>
                </div>
                <ChevronDown size={14} color="#9a9db5" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: `0 0 5px ${statusColor}99`, flexShrink: 0 }} />
                <span style={{
                  fontSize: '9px', color: statusColor, fontWeight: 700, letterSpacing: '0.05em',
                  opacity: flash ? 1 : 0, transition: 'opacity 0.18s ease',
                  whiteSpace: 'nowrap',
                }}>
                  {currentAlert ? alertSize : statusLabel}
                </span>
              </div>
              <span style={{ fontSize: '9px', color: '#c0c4d0' }}>{items.length} ukuran</span>
            </div>
          </div>
        </div>
        <StockBar quantity={totalQty} low={totalLow} critical={totalCritical} max={maxQty} />
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #e0e3ec', padding: '4px 14px 10px' }}>
          {[...items].sort((a, b) => {
            const p = (s: string) => s.replace(/^Plastik\s*/i, '').split(/[×x]/).map(Number);
            const [a1, a2] = p(a.productName), [b1, b2] = p(b.productName);
            return a1 !== b1 ? a1 - b1 : a2 - b2;
          }).map((s, i) => (
            <PlasticSubRow key={s.id} s={s} isLast={i === items.length - 1} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────── Addition Entry ───────────
function AdditionEntry({ entry, index }: { entry: AdditionRow; index: number }) {
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(entry.timestamp);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      animation: 'entry-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
      animationDelay: `${Math.min(index, 8) * 35}ms`,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4a90d9', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{entry.productName}</span>
      <span style={{ fontSize: '11px', color: '#52b96a', fontWeight: 700 }}>+{entry.quantity % 1 === 0 ? entry.quantity : entry.quantity.toFixed(1)} {entry.unit}</span>
      <span style={{ fontSize: '10px', color: '#c0c4d0', minWidth: 36 }}>{time}</span>
    </div>
  );
}

// ─────────── Correction Entry ───────────
function CorrectionEntry({ entry, index }: { entry: CorrectionRow; index: number }) {
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(entry.timestamp);
  const sign = entry.delta > 0 ? '+' : '';
  const color = entry.delta > 0 ? '#52b96a' : '#d4a017';
  const qty = Math.abs(entry.delta) % 1 === 0 ? Math.abs(entry.delta) : Math.abs(entry.delta).toFixed(1);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      animation: 'entry-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
      animationDelay: `${Math.min(index, 8) * 35}ms`,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '2px', background: '#d4a017', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{entry.productName}</span>
      <span style={{ fontSize: '10px', color: '#b0b4c8', fontWeight: 600, marginRight: 2 }}>koreksi</span>
      <span style={{ fontSize: '11px', color, fontWeight: 700 }}>{sign}{entry.delta % 1 === 0 ? entry.delta : entry.delta.toFixed(1)} {entry.unit}</span>
      <span style={{ fontSize: '10px', color: '#c0c4d0', minWidth: 36 }}>{time}</span>
    </div>
  );
}

// ─────────── Skeleton ───────────
function SkeletonBox({ w, h, r = 8, mt = 0 }: { w?: string | number; h: number; r?: number; mt?: number }) {
  return (
    <div style={{
      width: w ?? '100%', height: h, borderRadius: r,
      background: '#e0e3ec', marginTop: mt,
      animation: 'skel-pulse 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  );
}

function StockScreenSkeleton() {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px var(--app-page-gutter) 8px', gap: 10 }}>
      {/* Price ticker placeholder */}
      <SkeletonBox h={36} r={12} />

      {/* Alert row + button row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <SkeletonBox w={80} h={30} r={999} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <SkeletonBox w={34} h={32} r={9} />
          <SkeletonBox w={100} h={32} r={9} />
        </div>
      </div>

      {/* Stock cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SkeletonBox w={60} h={12} r={6} />
        {[0, 1, 2].map(i => <SkeletonBox key={i} h={72} r={14} />)}
        <SkeletonBox w={60} h={12} r={6} mt={4} />
        {[0, 1].map(i => <SkeletonBox key={i} h={72} r={14} />)}
      </div>

      <style>{`@keyframes skel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }`}</style>
    </div>
  );
}

// ─────────── Main Screen ───────────
export default function StockScreen() {
  const rawStock       = useQuery(api.stock.list);
  const rawAdditions   = useQuery(api.stock.listAdditions);
  const rawCorrections = useQuery(api.stock.listCorrections);
  const undoAdditionMutation = useMutation(api.stock.undoAddition);
  const setQuantityMutation  = useMutation(api.stock.setQuantity);
  const syncAll              = useAction(api.sheetsSync.syncAll);

  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [showAddStock, setShowAddStock]       = useState(false);
  const [editingStock, setEditingStock]       = useState<StockRow | null>(null);
  const [historyDate, setHistoryDate]         = useState<Date | null>(null);
  const [historyCalOpen, setHistoryCalOpen]   = useState(false);
  const [undoState, setUndoState]             = useState<{ result: AdditionResult; startedAt: number } | null>(null);
  const [syncState, setSyncState]             = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncError, setSyncError]             = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSync = async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    setSyncError(null);
    try {
      await syncAll({});
      setSyncState('done');
      if (syncResetRef.current) clearTimeout(syncResetRef.current);
      syncResetRef.current = setTimeout(() => setSyncState('idle'), 2200);
    } catch (e) {
      console.error(e);
      setSyncState('error');
      setSyncError(e instanceof Error ? e.message : String(e));
      if (syncResetRef.current) clearTimeout(syncResetRef.current);
      syncResetRef.current = setTimeout(() => setSyncState('idle'), 4500);
    }
  };

  useEffect(() => () => { if (syncResetRef.current) clearTimeout(syncResetRef.current); }, []);

  const stockItems: StockRow[] = useMemo(() => {
    if (!rawStock) return [];
    return rawStock
      .filter(s => s.productShortName !== 'E')
      .map(s => ({
        id: s.id as Id<'stock'>,
        productId: s.productId as Id<'products'>,
        variantId: s.variantId as Id<'productVariants'> | undefined,
        productName: s.productName,
        productShortName: s.productShortName,
        quantity: s.quantity,
        unit: s.unit,
        minThreshold: s.minThreshold,
        color: s.color,
      }));
  }, [rawStock]);

  const additions: AdditionRow[] = useMemo(() => {
    if (!rawAdditions) return [];
    return rawAdditions.map(a => ({
      id: a.id as Id<'stockAdditions'>,
      productName: a.productName,
      quantity: a.quantity,
      unit: a.unit,
      timestamp: new Date(a.timestamp),
    }));
  }, [rawAdditions]);

  const history: HistoryRow[] = useMemo(() => {
    const rows: HistoryRow[] = [
      ...additions.map(a => ({ kind: 'addition' as const, ...a })),
      ...(rawCorrections ?? []).map(c => ({
        kind: 'correction' as const,
        id: c.id as Id<'stockCorrections'>,
        productName: c.productName,
        delta: c.delta,
        unit: c.unit,
        timestamp: new Date(c.timestamp),
      })),
    ];
    rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return rows;
  }, [additions, rawCorrections]);

  const handleStockAdded = (result: AdditionResult) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ result, startedAt: Date.now() });
    undoTimerRef.current = setTimeout(() => setUndoState(null), UNDO_TOAST_MS);
  };

  const handleUndo = () => {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoAdditionMutation({ additionId: undoState.result.additionId }).catch(console.error);
    setUndoState(null);
  };

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  const soybeanStock  = stockItems.filter(s => s.unit === 'kg');
  const plasticItems  = stockItems.filter(s => s.unit !== 'kg' && !!s.variantId);
  const pureOther     = stockItems.filter(s => s.unit !== 'kg' && !s.variantId);
  const maxQty       = (s: StockRow) => Math.max(s.quantity, s.minThreshold * 6, 1);

  const criticalCount = stockItems.filter(s => s.quantity <= s.minThreshold).length;
  const lowCount      = stockItems.filter(s => s.quantity > s.minThreshold && s.quantity <= s.minThreshold * 3).length;

  const additionDates = useMemo(() => history.map(a => a.timestamp), [history]);

  const filteredHistory = useMemo(() => {
    if (!historyDate) return history.slice(0, 20);
    return history.filter(a => isSameDay(a.timestamp, historyDate));
  }, [history, historyDate]);

  const groupedHistory = useMemo(() => {
    if (historyDate) return null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const groups: { label: string; entries: HistoryRow[] }[] = [];
    filteredHistory.forEach(entry => {
      let label: string;
      if (isSameDay(entry.timestamp, today)) label = 'Hari Ini';
      else if (isSameDay(entry.timestamp, yesterday)) label = 'Kemarin';
      else {
        const y = entry.timestamp.getFullYear();
        label = `${entry.timestamp.getDate()} ${MONTHS[entry.timestamp.getMonth()]}${y !== today.getFullYear() ? ` ${y}` : ''}`;
      }
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, entries: [entry] });
      else last.entries.push(entry);
    });
    return groups;
  }, [filteredHistory, historyDate]);

  if (rawStock === undefined) return <StockScreenSkeleton />;

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', padding: '14px var(--app-page-gutter) 8px', gap: 10 }}>
      {showPriceEditor && <PriceEditorModal onClose={() => setShowPriceEditor(false)} />}
      {editingStock && (
        <SetQuantityModal
          s={editingStock}
          onClose={() => setEditingStock(null)}
          onConfirm={qty => setQuantityMutation({ stockId: editingStock.id, quantity: qty }).catch(console.error)}
        />
      )}
      {showAddStock && (
        <AddStockModal
          stockItems={stockItems}
          onClose={() => setShowAddStock(false)}
          onAdded={result => { setShowAddStock(false); handleStockAdded(result); }}
        />
      )}
      {historyCalOpen && (
        <StockCalendar
          selectedDate={historyDate}
          onSelect={setHistoryDate}
          onClose={() => setHistoryCalOpen(false)}
          additionDates={additionDates}
        />
      )}
      {undoState && <UndoToast result={undoState.result} startedAt={undoState.startedAt} onUndo={handleUndo} />}

      <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />

      {/* Stock alert + add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 7, animation: 'alert-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
          {criticalCount > 0 && (
            <div style={{
              background: '#eef0f5',
              boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px rgba(255,255,255,0.9)',
              borderRadius: '999px', padding: '7px 13px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4183d', boxShadow: '0 0 5px #d4183d99', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#d4183d', lineHeight: 1 }}>{criticalCount}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#c0c4d0', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Kritis</span>
            </div>
          )}
          {lowCount > 0 && (
            <div style={{
              background: '#eef0f5',
              boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px rgba(255,255,255,0.9)',
              borderRadius: '999px', padding: '7px 13px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4a017', boxShadow: '0 0 5px #d4a01799', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#d4a017', lineHeight: 1 }}>{lowCount}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#c0c4d0', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Rendah</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            aria-label="Sinkronkan ke Google Sheets"
            title={syncError ?? (syncState === 'done' ? 'Tersinkron' : 'Sinkron ke Google Sheets')}
            style={{
              height: 32, width: 34, borderRadius: '9px', border: 'none',
              cursor: syncState === 'syncing' ? 'default' : 'pointer',
              background: '#eef0f5',
              boxShadow: syncState === 'syncing' ? SHD_RECESSED : SHD_RAISED_STD,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: syncState === 'error' ? '#d4183d' : syncState === 'done' ? '#52b96a' : '#34a853',
              transition: 'box-shadow 0.12s, color 0.2s',
            }}
          >
            {syncState === 'syncing' ? (
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid #c0c4d0', borderTopColor: '#34a853',
                animation: 'sync-spin 0.7s linear infinite',
              }} />
            ) : syncState === 'done' ? (
              <Check size={13} />
            ) : (
              <FileSpreadsheet size={13} />
            )}
          </button>
          <button onClick={() => setShowAddStock(true)} style={{
            height: 32, padding: '0 11px', borderRadius: '9px', border: 'none', cursor: 'pointer',
            background: '#eef0f5', boxShadow: SHD_RAISED_STD,
            display: 'flex', alignItems: 'center', gap: 4, color: '#4a90d9', fontSize: '11px', fontWeight: 600,
            transition: 'box-shadow 0.12s',
          }}>
            <Plus size={12} /> Tambah Stok
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
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
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 14px, black 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0px, black 14px, black 100%)',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 2, flexShrink: 0 }}>Kedelai</div>
        {soybeanStock.map(s => <StockCard key={s.id} s={s} maxQty={maxQty(s)} onEdit={setEditingStock} />)}

        <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', paddingLeft: 2, marginTop: 4, flexShrink: 0 }}>Lainnya</div>
        {pureOther.map(s => <StockCard key={s.id} s={s} maxQty={maxQty(s)} onEdit={setEditingStock} />)}
        {plasticItems.length > 0 && <PlasticGroupCard items={plasticItems} onEdit={setEditingStock} />}

        {/* History section */}
        <div style={{
          marginTop: 6, background: '#eef0f5', boxShadow: SHD_RAISED_STD,
          borderRadius: '14px', padding: '12px 14px',
          flexShrink: 0,
        }}>
          <AdditionDateNav
            selectedDate={historyDate}
            calOpen={historyCalOpen}
            onToggleCal={() => setHistoryCalOpen(o => !o)}
          />

          <div style={{ marginTop: 10 }}>
            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#c0c4d0', fontSize: '12px' }}>
                {historyDate ? 'Tidak ada penambahan pada tanggal ini' : 'Belum ada riwayat'}
              </div>
            ) : (
              <>
                {historyDate && (
                  <div style={{ fontSize: '10px', color: '#9a9db5', marginBottom: 6 }}>
                    {MONTHS[historyDate.getMonth()]} {historyDate.getDate()}, {historyDate.getFullYear()} · {filteredHistory.length} entri
                  </div>
                )}
                <div key={historyDate?.toISOString() ?? 'all'} style={{ display: 'flex', flexDirection: 'column' }}>
                  {historyDate
                    ? filteredHistory.map((entry, i) =>
                        entry.kind === 'correction'
                          ? <CorrectionEntry key={entry.id} entry={entry} index={i} />
                          : <AdditionEntry key={entry.id} entry={entry} index={i} />
                      )
                    : (groupedHistory ?? []).map((group, gi) => (
                        <div key={group.label}>
                          {gi > 0 && <div style={{ height: 1, background: '#e8eaf0', margin: '6px 0' }} />}
                          <div style={{ fontSize: '9px', fontWeight: 600, color: '#c0c4d0', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 0 2px' }}>
                            {group.label}
                          </div>
                          {group.entries.map((entry, i) =>
                            entry.kind === 'correction'
                              ? <CorrectionEntry key={entry.id} entry={entry} index={i} />
                              : <AdditionEntry key={entry.id} entry={entry} index={i} />
                          )}
                        </div>
                      ))
                  }
                </div>
                {!historyDate && history.length > 20 && (
                  <div style={{ textAlign: 'center', padding: '10px 0 2px', fontSize: '10px', color: '#c0c4d0' }}>
                    Menampilkan 20 entri terbaru · Filter tanggal untuk melihat riwayat
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade overlay */}
      <div aria-hidden style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 72,
        background: 'linear-gradient(to bottom, transparent, #eef0f5)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      <style>{`
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes alert-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cal-modal-in {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes entry-in {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sync-spin {
          to { transform: rotate(360deg); }
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
