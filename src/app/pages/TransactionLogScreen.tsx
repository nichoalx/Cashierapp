import { useState, useRef, useEffect, useMemo } from 'react';
import { Pencil, Trash2, X, Check, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, MessageSquare, User, Receipt, FileSpreadsheet, FileDown, Printer } from 'lucide-react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { formatRupiah, TransactionItem, Member } from '../store';
import { MemberPickerModal } from '../components/MemberPickerModal';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';
import { printReceipt } from '../../utils/printer';

const SHD_RAISED_STD    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RAISED_LIST   = '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92)';
const SHD_RAISED_STRONG = '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff';
const SHD_RECESSED      = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';
const SHD_ACTION_PRESS  = 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)';
const SHD_CALENDAR      = '8px 8px 18px #c0c3ca, -6px -6px 14px #ffffff';

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toDateStr(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Local types for mapped Convex data ─────────────────────────────────────

interface TxItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  productShortName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  color: string;
  plasticSize?: string;
}

interface Tx {
  id: string;
  orderNumber: number;
  timestamp: Date;
  total: number;
  discount: number;
  amountPaid: number;
  balance: number;
  remarks?: string;
  memberId?: string;
  memberName?: string;
  items: TxItem[];
}

// ─── MiniCalendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate, onSelect, onClose,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const [viewYear, setViewYear]   = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const today = new Date();

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

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
        <button aria-label="Bulan sebelumnya" onClick={prevMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, color: '#9a9db5' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button aria-label="Bulan berikutnya" onClick={nextMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10, color: '#9a9db5' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: '#c0c4d0', fontWeight: 700, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const cellDate  = new Date(viewYear, viewMonth, day);
          const isSelected = isSameDay(cellDate, selectedDate);
          const isToday   = isSameDay(cellDate, today);
          return (
            <button
              key={i}
              onClick={() => { onSelect(cellDate); onClose(); }}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: isSelected || isToday ? 700 : 400,
                background: isSelected ? '#4a90d9' : '#eef0f5',
                color: isSelected ? '#fff' : isToday ? '#4a90d9' : '#2d3142',
                boxShadow: isSelected
                  ? '2px 2px 5px rgba(74,144,217,0.4)'
                  : '2px 2px 4px #c8cad1, -2px -2px 4px #ffffff',
                transition: 'background 0.12s, box-shadow 0.12s',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => { onSelect(new Date()); onClose(); }}
        style={{
          width: '100%', marginTop: 10, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          background: '#eef0f5', boxShadow: SHD_RAISED_STD,
          fontSize: '11px', fontWeight: 600, color: '#4a90d9',
        }}
      >
        Hari Ini
      </button>
    </div>
    </div>
  );
}

function DateNavigator({ selectedDate, onChange }: { selectedDate: Date; onChange: (d: Date) => void }) {
  const [calOpen, setCalOpen] = useState(false);

  const prevDay = () => {
    const d = new Date(selectedDate); d.setDate(d.getDate() - 1); onChange(d);
  };
  const nextDay = () => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + 1); onChange(d);
  };

  const today   = new Date();
  const isToday = isSameDay(selectedDate, today);
  const label   = isToday
    ? `Today, ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`
    : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#eef0f5',
        boxShadow: calOpen ? SHD_RECESSED : SHD_RAISED_STD,
        borderRadius: '22px', height: 44, overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}>
        <button
          aria-label="Hari sebelumnya"
          onClick={prevDay}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <ChevronLeft size={15} color="#9a9db5" />
        </button>

        <button
          aria-label="Pilih tanggal"
          aria-expanded={calOpen}
          onClick={() => setCalOpen(o => !o)}
          style={{
            flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '0 4px', height: 44,
            fontSize: '13px', fontWeight: 700, color: '#2d3142',
          }}
        >
          {label}
        </button>

        <button
          aria-label="Hari berikutnya"
          onClick={nextDay}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <ChevronRight size={15} color="#9a9db5" />
        </button>
      </div>

      {calOpen && (
        <MiniCalendar
          selectedDate={selectedDate}
          onSelect={onChange}
          onClose={() => setCalOpen(false)}
        />
      )}
    </>
  );
}

// ─── EditModal ───────────────────────────────────────────────────────────────

interface PlasticVariant { variantId: string; label: string; }

interface EditModalProps {
  transaction: Tx;
  members: Member[];
  plasticVariants: PlasticVariant[];
  onClose: () => void;
  onSave: (items: TransactionItem[], remarks: string, discount: number, memberId?: string, memberName?: string) => void;
}

function EditModal({ transaction, members, plasticVariants, onClose, onSave }: EditModalProps) {
  const [items, setItems]           = useState<TransactionItem[]>(transaction.items.map(i => ({ ...i })));
  const [editRemarks, setEditRemarks] = useState(transaction.remarks ?? '');
  const [editDiscount, setEditDiscount] = useState(transaction.discount > 0 ? String(transaction.discount) : '');
  const [editMember, setEditMember]   = useState<Member | null>(
    members.find(m => m.id === transaction.memberId) ?? null
  );
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [savePressed, setSavePressed] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 16);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const updateQty  = (id: string, val: string) => {
    const qty = parseFloat(val) || 0;
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty, total: qty * i.unitPrice } : i));
  };
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateVariant = (id: string, variantId: string) => {
    const v = plasticVariants.find(pv => pv.variantId === variantId);
    setItems(prev => prev.map(i => i.id === id ? { ...i, variantId, plasticSize: v?.label } : i));
  };
  const newSubtotal = items.reduce((s, i) => s + i.total, 0);
  const parsedDiscount = Math.max(0, Math.min(parseFloat(editDiscount) || 0, newSubtotal));
  const newTotal   = newSubtotal - parsedDiscount;

  const sheetTransform = !entered
    ? 'translateY(100%)'
    : showMemberPicker
    ? 'scale(0.93)'
    : 'translateY(0)';

  return (
    <>
      <div
        className="fixed z-50 flex items-end justify-center"
        style={{
          left: 0,
          right: 0,
          top: 'var(--app-visual-offset-top)',
          height: 'var(--app-visual-height)',
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: showMemberPicker ? 'none' : 'blur(4px)',
          transition: 'backdrop-filter 0.25s',
        }}
        onClick={showMemberPicker ? undefined : onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          onClick={e => e.stopPropagation()}
          style={{
            background: '#eef0f5',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
            borderRadius: '24px 24px 0 0',
            width: '100%', maxWidth: 430, maxHeight: 'min(80vh, calc(var(--app-visual-height) - 16px))',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transform: sheetTransform,
            transformOrigin: 'center bottom',
            opacity: showMemberPicker ? 0.62 : 1,
            transition: entered
              ? 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s'
              : 'none',
          }}
        >
          <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Edit</div>
              <h3 id="edit-modal-title" style={{ margin: '2px 0 0', color: '#2d3142', fontSize: '18px', fontWeight: 700 }}>Order #{transaction.orderNumber}</h3>
            </div>
            <button aria-label="Tutup" onClick={onClose} style={{
              background: '#eef0f5', boxShadow: SHD_RAISED_STD,
              border: 'none', borderRadius: '11px', width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <X size={16} color="#9a9db5" />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
            {items.map(item => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#eef0f5', boxShadow: SHD_RECESSED,
                  borderRadius: '12px', padding: '10px 12px',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>{item.productName}</div>
                    <div style={{ fontSize: '11px', color: '#9a9db5' }}>{formatRupiah(item.unitPrice)}/{item.unit}</div>
                  </div>
                  <input
                    type="number"
                    defaultValue={item.quantity}
                    onChange={e => updateQty(item.id, e.target.value)}
                    style={{
                      width: 72, textAlign: 'right', background: '#eef0f5',
                      boxShadow: 'inset 2px 2px 5px #c0c3ca, inset -2px -2px 5px #f8f9fc',
                      borderRadius: '8px', border: 'none', outline: 'none',
                      padding: '5px 8px', fontSize: '14px', color: '#2d3142',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#9a9db5', width: 20 }}>{item.unit}</span>
                  <button
                    aria-label={`Hapus ${item.productName}`}
                    onClick={() => removeItem(item.id)}
                    style={{ background: 'transparent', border: 'none', color: '#d4183d', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {item.plasticSize !== undefined && plasticVariants.length > 0 && (
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <select
                      value={item.variantId ?? ''}
                      onChange={e => updateVariant(item.id, e.target.value)}
                      style={{
                        width: '100%', appearance: 'none', WebkitAppearance: 'none',
                        background: '#eef0f5',
                        boxShadow: 'inset 2px 2px 5px #c0c3ca, inset -2px -2px 5px #f8f9fc',
                        borderRadius: '8px', border: 'none', outline: 'none',
                        padding: '7px 28px 7px 12px',
                        fontSize: '12px', fontWeight: 600, color: '#2d3142',
                        cursor: 'pointer',
                      }}
                    >
                      {plasticVariants.map(pv => (
                        <option key={pv.variantId} value={pv.variantId}>{pv.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} color="#9a9db5" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 4, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>Catatan &amp; Pembeli</div>
              <div style={{ position: 'relative' }}>
                <MessageSquare size={13} color="#9a9db5" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Catatan..."
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#eef0f5',
                    boxShadow: 'inset 2px 2px 5px #c0c3ca, inset -2px -2px 5px #f8f9fc',
                    borderRadius: '10px', border: 'none', outline: 'none',
                    padding: '9px 10px 9px 32px',
                    fontSize: '13px', color: '#2d3142',
                  }}
                />
              </div>
              <button
                onClick={() => setShowMemberPicker(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  background: '#eef0f5',
                  boxShadow: 'inset 2px 2px 5px #c0c3ca, inset -2px -2px 5px #f8f9fc',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  padding: '9px 10px',
                }}
              >
                <User size={13} color={editMember ? '#4a90d9' : '#9a9db5'} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', color: editMember ? '#2d3142' : '#9a9db5' }}>
                  {editMember ? editMember.name : 'Pilih pembeli...'}
                </span>
                <ChevronRight size={13} color="#c0c4d0" style={{ flexShrink: 0 }} />
              </button>
              <div style={{ position: 'relative' }}>
                <span aria-hidden style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: '12px', fontWeight: 700,
                  color: parsedDiscount > 0 ? '#d4183d' : '#9a9db5',
                  pointerEvents: 'none',
                }}>%</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Diskon (Rp)"
                  value={editDiscount}
                  onChange={e => setEditDiscount(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#eef0f5',
                    boxShadow: 'inset 2px 2px 5px #c0c3ca, inset -2px -2px 5px #f8f9fc',
                    borderRadius: '10px', border: 'none', outline: 'none',
                    padding: '9px 10px 9px 32px',
                    fontSize: '13px', color: parsedDiscount > 0 ? '#d4183d' : '#2d3142',
                    fontWeight: parsedDiscount > 0 ? 600 : 400,
                  }}
                />
                {editDiscount && (
                  <button
                    aria-label="Hapus diskon"
                    onClick={() => setEditDiscount('')}
                    style={{
                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', cursor: 'pointer', padding: 8,
                    }}
                  >
                    <X size={12} color="#9a9db5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {parsedDiscount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>Subtotal</span>
                    <span style={{ fontSize: '12px', color: '#9a9db5' }}>{formatRupiah(newSubtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#d4183d', fontWeight: 600 }}>Diskon</span>
                    <span style={{ fontSize: '12px', color: '#d4183d', fontWeight: 600 }}>−{formatRupiah(parsedDiscount)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: parsedDiscount > 0 ? 4 : 0, paddingTop: parsedDiscount > 0 ? 4 : 0, borderTop: parsedDiscount > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                <span style={{ fontSize: '13px', color: '#9a9db5' }}>Total Baru</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(newTotal)}</span>
              </div>
            </div>
            <button
              onClick={() => { onSave(items, editRemarks, parsedDiscount, editMember?.id, editMember?.name); onClose(); }}
              onPointerDown={() => setSavePressed(true)}
              onPointerUp={() => setSavePressed(false)}
              onPointerLeave={() => setSavePressed(false)}
              style={{
                width: '100%', height: 48, borderRadius: '14px', border: 'none',
                background: '#4a90d9', color: '#fff', fontWeight: 700, fontSize: '14px',
                boxShadow: savePressed ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                transform: savePressed ? 'scale(0.97)' : 'scale(1)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'box-shadow 0.07s, transform 0.07s',
              }}
            >
              <Check size={16} /> Simpan Perubahan
            </button>
          </div>
        </div>
      </div>

      {showMemberPicker && (
        <MemberPickerModal
          members={members}
          onSelect={m => setEditMember(m)}
          onClose={() => setShowMemberPicker(false)}
        />
      )}
    </>
  );
}

// ─── Receipt preview ─────────────────────────────────────────────────────────

function buildReceiptPreview(tx: Tx): string {
  const W = 32;
  const pad = (left: string, right: string, w = W) =>
    left + ' '.repeat(Math.max(1, w - left.length - right.length)) + right;
  const center = (s: string, w = W) => ' '.repeat(Math.floor((w - s.length) / 2)) + s;
  const rp = (n: number) => `Rp. ${n.toLocaleString('id-ID')}`;
  const fmtQty = (q: number) => (q % 1 === 0 ? String(q) : q.toFixed(1));
  const d = tx.timestamp;
  const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const orderNum = `#${String(tx.orderNumber).padStart(3,'0')}`;
  const LINE = '-'.repeat(W);
  const subtotal = tx.items.reduce((s, i) => s + i.total, 0);

  const lines: string[] = [
    center('Agro Muda Anugerah'),
    center('Jl. Gatot Subroto No. 712'),
    center('Randudongkal, Pemalang, 52353.'),
    center('+62 819-3067-7877'),
    '',
    '',
    pad(date, orderNum),
    LINE,
  ];

  for (const item of tx.items) {
    const name = item.productName + (item.plasticSize ? ` ${item.plasticSize}` : '');
    const qty  = `${fmtQty(item.quantity)} ${item.unit} x ${rp(item.unitPrice)}`;
    lines.push(name, pad(qty, rp(item.total)), '');
  }

  lines.push(LINE);
  if (tx.discount > 0) {
    lines.push(pad('Subtotal', rp(subtotal)));
    lines.push(pad('Diskon', `-${rp(tx.discount)}`));
  }
  lines.push(pad('TOTAL.', rp(tx.total)));
  if (tx.remarks) lines.push('', tx.remarks);
  lines.push('', '', center('Terima Kasih!'), '', '');

  return lines.join('\n');
}

function ZigzagBottom() {
  const tw = 8, th = 6, count = 50;
  const w = count * tw;
  let d = `M 0,0 L ${w},0`;
  for (let i = count; i > 0; i--) {
    d += ` L ${(i - 0.5) * tw},${th} L ${(i - 1) * tw},0`;
  }
  d += ' Z';
  return (
    <svg viewBox={`0 0 ${w} ${th}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: th, flexShrink: 0 }}>
      <path d={d} fill="white" />
    </svg>
  );
}

function ReceiptPreviewModal({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const [printState, setPrintState]     = useState<'idle' | 'printing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg]         = useState('');
  const [printPressed, setPrintPressed] = useState(false);
  const [cancelPressed, setCancelPressed] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && printState !== 'printing') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, printState]);

  const handlePrint = async () => {
    if (printState === 'printing' || printState === 'done') return;
    setPrintState('printing');
    setErrorMsg('');
    try {
      await printReceipt({
        timestamp: tx.timestamp.getTime(),
        orderNumber: tx.orderNumber,
        items: tx.items.map(i => ({
          productName: i.productName,
          variantValue: i.plasticSize ?? null,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
        })),
        totalAmount: tx.total,
        discount: tx.discount,
        remarks: tx.remarks,
      });
      setPrintState('done');
      setTimeout(onClose, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const friendly = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('chooser')
        ? 'Printer tidak dipilih. Coba lagi.'
        : msg.toLowerCase().includes('gatt') || msg.toLowerCase().includes('connect')
        ? 'Gagal terhubung ke printer. Pastikan printer menyala.'
        : msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no device')
        ? 'Printer tidak ditemukan. Periksa Bluetooth.'
        : 'Gagal mencetak. Coba lagi.';
      setErrorMsg(friendly);
      setPrintState('error');
    }
  };

  const preview  = buildReceiptPreview(tx);
  const printing = printState === 'printing';
  const done     = printState === 'done';
  const error    = printState === 'error';

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0,
        top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)',
        zIndex: 60,
        background: 'rgba(0,0,0,0.48)',
        backdropFilter: 'blur(7px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
      onClick={printing ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview struk #${tx.orderNumber}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 300,
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          animation: 'cal-modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* Receipt paper — shadow via filter so it follows the zigzag silhouette */}
        <div style={{ width: '100%', filter: 'drop-shadow(0 8px 36px rgba(0,0,0,0.32))' }}>
          <div style={{
            background: 'white',
            borderRadius: '14px 14px 0 0',
            maxHeight: '58vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '18px 16px 12px',
            display: 'flex', justifyContent: 'center',
          }}>
            <pre style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '10.5px', lineHeight: 1.65,
              margin: 0, color: '#1a1a1a',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              width: '32ch', flexShrink: 0,
            }}>
              {preview}
            </pre>
          </div>
          <ZigzagBottom />
        </div>

        {/* Error message */}
        {error && errorMsg && (
          <div style={{ fontSize: '11px', color: 'rgba(255,220,220,0.9)', textAlign: 'center', marginTop: 10, lineHeight: 1.4 }}>
            {errorMsg}
          </div>
        )}

        {/* Buttons — float below the receipt on the blur backdrop */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={printing}
            onPointerDown={() => setCancelPressed(true)}
            onPointerUp={() => setCancelPressed(false)}
            onPointerLeave={() => setCancelPressed(false)}
            style={{
              flex: 1, height: 50, borderRadius: '14px', border: 'none',
              cursor: printing ? 'default' : 'pointer',
              background: 'rgba(238,240,245,0.92)',
              boxShadow: 'none',
              transform: cancelPressed && !printing ? 'scale(0.97)' : 'scale(1)',
              fontSize: '14px', fontWeight: 600, color: '#9a9db5',
              opacity: printing ? 0.4 : 1,
              backdropFilter: 'blur(4px)',
              transition: 'box-shadow 0.07s, transform 0.07s, opacity 0.15s',
            }}
          >
            Batal
          </button>
          <button
            onClick={handlePrint}
            disabled={printing || done}
            onPointerDown={() => { if (!printing && !done) setPrintPressed(true); }}
            onPointerUp={() => setPrintPressed(false)}
            onPointerLeave={() => setPrintPressed(false)}
            style={{
              flex: 2, height: 50, borderRadius: '14px', border: 'none',
              cursor: printing || done ? 'default' : 'pointer',
              background: done ? '#52b96a' : error ? '#d4183d' : '#4a90d9',
              color: '#fff', fontWeight: 700, fontSize: '14px',
              boxShadow: 'none',
              transform: printPressed ? 'scale(0.97)' : 'scale(1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s, box-shadow 0.07s, transform 0.07s',
            }}
          >
            {printing ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'sheets-sync-spin 0.7s linear infinite' }} />
                Mencetak...
              </>
            ) : done ? (
              <><Check size={16} /> Berhasil!</>
            ) : error ? (
              <><Printer size={14} /> Coba Lagi</>
            ) : (
              <><Printer size={14} /> Cetak</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportCSV(txs: Tx[], date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const header = 'Date,Order,Time,Product,Qty,Unit,Unit Price,Item Total,Discount,Tx Total,Member,Remarks';
  const rows = txs.flatMap(tx =>
    tx.items.map(item => [
      dateStr,
      tx.orderNumber,
      formatTime(tx.timestamp),
      `"${item.productName}"`,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.total,
      tx.discount,
      tx.total,
      tx.memberName ? `"${tx.memberName}"` : '',
      tx.remarks   ? `"${tx.remarks.replace(/"/g, '""')}"` : '',
    ].join(','))
  );
  const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `transaksi-${dateStr}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkelBox({ w, h, r = 8, mt = 0 }: { w?: string | number; h: number; r?: number; mt?: number }) {
  return (
    <div style={{
      width: w ?? '100%', height: h, borderRadius: r,
      background: '#e0e3ec', marginTop: mt,
      animation: 'skel-pulse 1.4s ease-in-out infinite',
      flexShrink: 0,
    }} />
  );
}


function TransactionLogSkeleton() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px var(--app-page-gutter) 8px', gap: 0 }}>
      <style>{`@keyframes skel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }`}</style>

      {/* Price ticker */}
      <SkelBox h={36} r={12} />

      {/* Date nav */}
      <SkelBox h={44} r={22} mt={10} />

      {/* Summary carousel */}
      <SkelBox h={104} r={16} mt={10} />

      {/* Search */}
      <SkelBox h={44} r={12} mt={20} />

      {/* Transaction rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {[76, 60, 76, 60, 60].map((h, i) => <SkelBox key={i} h={h} r={16} />)}
      </div>
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TransactionLogScreen() {
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [editingTx, setEditingTx]             = useState<Tx | null>(null);
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]     = useState<string | null>(null);
  const [pressedBtn, setPressedBtn]           = useState<string | null>(null);
  const [pressedRow, setPressedRow]           = useState<string | null>(null);
  const [selectedDate, setSelectedDate]       = useState(new Date());
  const [searchQuery, setSearchQuery]         = useState('');
  const [activeFilters, setActiveFilters]     = useState<Set<'soybean' | 'plastic' | 'other'>>(new Set());
  const [filterOpen, setFilterOpen]           = useState(false);
  const [filterBtnPressed, setFilterBtnPressed] = useState(false);
  const hasLoadedOnce = useRef(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const savedIdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef  = useRef<{ start: number; delta: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [summarySlide, setSummarySlide] = useState(0);
  const [savedId, setSavedId]           = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; orderNumber: number } | null>(null);
  const [printingTx, setPrintingTx]       = useState<Tx | null>(null);
  const deleteTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<{ id: string; orderNumber: number } | null>(null);

  // ── Convex hooks ──────────────────────────────────────────────────────────
  const rawMembers = useQuery(api.members.list);
  const rawTxs     = useQuery(api.transactions.listByDate, { date: toDateStr(selectedDate) });
  const rawStock   = useQuery(api.stock.list);
  const updateTx   = useMutation(api.transactions.update);
  const removeTx   = useMutation(api.transactions.remove);
  const syncAll    = useAction(api.sheetsSync.syncAll);

  const [sheetsSyncState, setSheetsSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [sheetsSyncError, setSheetsSyncError] = useState<string | null>(null);
  const sheetsResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSheetsSync = async () => {
    if (sheetsSyncState === 'syncing') return;
    setSheetsSyncState('syncing');
    setSheetsSyncError(null);
    try {
      await syncAll({});
      setSheetsSyncState('done');
      if (sheetsResetRef.current) clearTimeout(sheetsResetRef.current);
      sheetsResetRef.current = setTimeout(() => setSheetsSyncState('idle'), 2200);
    } catch (e) {
      console.error(e);
      setSheetsSyncState('error');
      setSheetsSyncError(e instanceof Error ? e.message : String(e));
      if (sheetsResetRef.current) clearTimeout(sheetsResetRef.current);
      sheetsResetRef.current = setTimeout(() => setSheetsSyncState('idle'), 4500);
    }
  };

  useEffect(() => () => { if (sheetsResetRef.current) clearTimeout(sheetsResetRef.current); }, []);

  const members: Member[] = useMemo(() =>
    (rawMembers ?? []).map(m => ({
      id: m._id, name: m.name, phone: m.phone ?? '', createdAt: new Date(m._creationTime),
    })),
    [rawMembers]
  );

  const plasticVariants = useMemo(() => {
    if (!rawStock) return [];
    return rawStock
      .filter(s => s.variantId)
      .map(s => ({ variantId: s.variantId as string, label: s.productName.replace(/^Plastik\s+/i, '') }))
      .sort((a, b) => {
        const parse = (label: string) => { const m = label.match(/(\d+)[×xX](\d+)/); return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0]; };
        const [a1, a2] = parse(a.label);
        const [b1, b2] = parse(b.label);
        return a1 !== b1 ? a1 - b1 : a2 - b2;
      });
  }, [rawStock]);

  const transactions: Tx[] = useMemo(() => {
    if (!rawTxs) return [];
    return rawTxs.map(tx => ({
      id: tx.id as string,
      orderNumber: tx.orderNumber,
      timestamp: new Date(tx.timestamp),
      total: tx.total,
      discount: tx.discount ?? 0,
      amountPaid: tx.amountPaid,
      balance: tx.balance,
      remarks: tx.remarks,
      memberId: tx.memberId as string | undefined,
      memberName: tx.memberName,
      items: tx.items.map(item => ({
        id: item.id as string,
        productId: item.productId as string,
        variantId: item.variantId as string | undefined,
        productName: item.productName,
        productShortName: item.productShortName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
        color: item.color,
        plasticSize: item.plasticSize,
      })),
    }));
  }, [rawTxs]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const toggleFilter = (key: 'soybean' | 'plastic' | 'other') => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    return () => { if (savedIdTimerRef.current) clearTimeout(savedIdTimerRef.current); };
  }, []);

  useEffect(() => { pendingDeleteRef.current = pendingDelete; }, [pendingDelete]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (pendingDeleteRef.current) removeTx({ txId: pendingDeleteRef.current.id as Id<'transactions'> }).catch(console.error);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndoDelete = () => {
    if (deleteTimerRef.current) { clearTimeout(deleteTimerRef.current); deleteTimerRef.current = null; }
    setPendingDelete(null);
  };

  useEffect(() => {
    if (!filterOpen) return;
    const mouseHandler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [filterOpen]);

  const filteredTxs = useMemo(() => {
    let list = pendingDelete
      ? transactions.filter(t => t.id !== pendingDelete.id)
      : transactions;
    if (activeFilters.size > 0) {
      list = list.filter(t => {
        if (activeFilters.has('soybean') && t.items.some(i => i.unit === 'kg')) return true;
        if (activeFilters.has('plastic') && t.items.some(i => i.plasticSize !== undefined)) return true;
        if (activeFilters.has('other')   && t.items.some(i => i.unit === 'pcs' && !i.plasticSize)) return true;
        return false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => {
        const matchOrder   = String(t.orderNumber).includes(q);
        const matchRemarks = t.remarks?.toLowerCase().includes(q);
        const matchMember  = t.memberName?.toLowerCase().includes(q);
        const matchProduct = t.items.some(i =>
          i.productName.toLowerCase().includes(q) ||
          i.productShortName.toLowerCase().includes(q) ||
          String(i.quantity).includes(q)
        );
        return matchOrder || matchRemarks || matchMember || matchProduct;
      });
    }
    return list;
  }, [transactions, activeFilters, searchQuery, pendingDelete]);

  const summaryStats = useMemo(() => {
    const allItems = transactions.flatMap(t => t.items);
    const itemMap: Record<string, { qty: number; label: string; color: string; unit: string; isSoybean: boolean }> = {};

    for (const item of allItems) {
      const key = item.plasticSize ? `plastic-${item.plasticSize}` : item.unit === 'kg' ? item.productShortName : item.productId;
      const label = item.unit === 'kg'
        ? item.productShortName
        : item.plasticSize ? `Plastik ${item.plasticSize}` : item.productName;
      if (!itemMap[key])
        itemMap[key] = { qty: 0, label, color: item.color, unit: item.unit, isSoybean: item.unit === 'kg' };
      itemMap[key].qty += item.quantity;
    }

    const top3 = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 3);
    return { top3 };
  }, [transactions]);

  const rawDayTotal = transactions.reduce((s, t) => s + t.total, 0);

  if (rawTxs !== undefined) hasLoadedOnce.current = true;
  if (rawTxs === undefined && !hasLoadedOnce.current) return <TransactionLogSkeleton />;
  const isDateLoading = rawTxs === undefined;

  const renderTxList = () => (
    <div style={{
      flex: 1,
      flexBasis: 0,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      margin: '0 -8px',
      padding: '4px 8px var(--app-content-bottom)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 14px, black 100%)',
      maskImage: 'linear-gradient(to bottom, transparent 0px, black 14px, black 100%)',
    }}>
      {filteredTxs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '14px',
            background: '#eef0f5', boxShadow: SHD_RAISED_STD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            {searchQuery
              ? <Search size={22} color="#c0c4d0" />
              : <Receipt size={22} color="#c0c4d0" />
            }
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#9a9db5' }}>
            {searchQuery ? 'Tidak ditemukan' : 'Belum ada transaksi'}
          </div>
          <div style={{ fontSize: '11px', color: '#c0c4d0', marginTop: 4 }}>
            {searchQuery
              ? 'Coba kata kunci lain'
              : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
            }
          </div>
        </div>
      ) : (
        filteredTxs.map(tx => {
          const expanded   = expandedId === tx.id;
          const confirming = deleteConfirm === tx.id;
          return (
            <div key={tx.id} style={{
              background: '#eef0f5',
              boxShadow: savedId === tx.id
                ? `0 0 0 2px rgba(74,144,217,0.45), ${SHD_RAISED_LIST}`
                : SHD_RAISED_LIST,
              borderRadius: '16px', overflow: 'hidden',
              transition: savedId === tx.id ? 'none' : 'box-shadow 0.6s ease-out',
              flexShrink: 0,
            }}>
              {/* Row */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`Order #${tx.orderNumber}, ${formatRupiah(tx.total)}`}
                style={{
                  padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  transform: pressedRow === tx.id ? 'scale(0.985)' : 'scale(1)',
                  transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onClick={() => setExpandedId(expanded ? null : tx.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : tx.id); } }}
                onPointerDown={() => setPressedRow(tx.id)}
                onPointerUp={() => setPressedRow(null)}
                onPointerLeave={() => setPressedRow(null)}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '10px', background: '#eef0f5',
                  boxShadow: SHD_RECESSED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a90d9' }}>#{tx.orderNumber}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {tx.items.map((item, i) => (
                        <span key={i} style={{
                          fontSize: '10px', fontWeight: 600, color: item.color,
                          background: `${item.color}18`, borderRadius: '5px', padding: '1px 5px',
                        }}>
                          {item.productShortName}{item.plasticSize ? ` ${item.plasticSize}` : ''}
                        </span>
                      ))}
                    </div>
                    {tx.balance > 0 && (
                      <span style={{
                        fontSize: '7px', fontWeight: 700, color: '#d97706',
                        background: 'rgba(217,119,6,0.12)', borderRadius: '5px',
                        padding: '1px 5px', letterSpacing: '0.07em', flexShrink: 0,
                      }}>
                        KREDIT
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: '11px', color: '#9a9db5' }}>{formatTime(tx.timestamp)}</span>
                      {tx.memberName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <User size={9} color="#52b96a" />
                          <span style={{ fontSize: '9px', color: '#52b96a', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.memberName}</span>
                        </div>
                      )}
                      {tx.remarks && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MessageSquare size={9} color="#4a90d9" />
                          <span style={{ fontSize: '9px', color: '#4a90d9', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.remarks}</span>
                        </div>
                      )}
                      {tx.discount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} aria-label={`Diskon ${formatRupiah(tx.discount)}`}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#d4183d' }}>%</span>
                          <span style={{ fontSize: '9px', color: '#d4183d', whiteSpace: 'nowrap' }}>−{formatRupiah(tx.discount)}</span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: tx.balance > 0 ? '#d97706' : '#2d3142' }}>
                      {formatRupiah(tx.total)}
                    </span>
                  </div>
                </div>

                <ChevronDown size={14} color="#9a9db5" style={{ transform: expanded ? 'rotate(-180deg)' : 'rotate(0deg)', transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0 }} />
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div style={{ padding: '0 16px 14px', animation: 'tx-expand-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                  <div style={{ paddingTop: 10 }}>
                    {tx.items.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', flex: 1, color: '#4a4e69' }}>{item.productName}</span>
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>
                          {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)} {item.unit}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>{formatRupiah(item.total)}</span>
                      </div>
                    ))}
                    {tx.remarks && (
                      <div style={{ display: 'flex', gap: 6, paddingTop: 10, marginTop: 4 }}>
                        <MessageSquare size={11} color="#4a90d9" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: '11px', color: '#4a4e69', fontStyle: 'italic' }}>{tx.remarks}</span>
                      </div>
                    )}
                    {tx.discount > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: '#9a9db5' }}>Subtotal</span>
                          <span style={{ fontSize: '11px', color: '#9a9db5' }}>{formatRupiah(tx.total + tx.discount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: '#d4183d', fontWeight: 600 }}>Diskon</span>
                          <span style={{ fontSize: '11px', color: '#d4183d', fontWeight: 600 }}>−{formatRupiah(tx.discount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 3, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          <span style={{ fontSize: '10px', color: '#2d3142', fontWeight: 700 }}>Total</span>
                          <span style={{ fontSize: '12px', color: '#2d3142', fontWeight: 700 }}>{formatRupiah(tx.total)}</span>
                        </div>
                      </div>
                    )}

                    {tx.balance > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#d97706', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                          Kredit
                        </div>
                        {tx.amountPaid > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '10px', color: '#52b96a', fontWeight: 600 }}>Terbayar</span>
                            <span style={{ fontSize: '11px', color: '#52b96a', fontWeight: 600 }}>{formatRupiah(tx.amountPaid)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 700 }}>Sisa</span>
                          <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 700 }}>{formatRupiah(tx.balance)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      aria-label="Cetak struk"
                      onClick={e => { e.stopPropagation(); setPrintingTx(tx); }}
                      onPointerDown={() => setPressedBtn(`print_${tx.id}`)}
                      onPointerUp={() => setPressedBtn(null)}
                      onPointerLeave={() => setPressedBtn(null)}
                      style={{
                        width: 44, height: 44, borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: '#eef0f5',
                        boxShadow: pressedBtn === `print_${tx.id}` ? SHD_RECESSED : SHD_RAISED_STD,
                        transform: pressedBtn === `print_${tx.id}` ? 'scale(0.96)' : 'scale(1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'box-shadow 0.07s, transform 0.07s',
                        flexShrink: 0,
                      }}
                    >
                      <Printer size={13} color="#9a9db5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}
                      onPointerDown={() => setPressedBtn(`edit_${tx.id}`)}
                      onPointerUp={() => setPressedBtn(null)}
                      onPointerLeave={() => setPressedBtn(null)}
                      style={{
                        flex: 1, height: 44, borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: '#eef0f5',
                        boxShadow: pressedBtn === `edit_${tx.id}` ? SHD_RECESSED : SHD_RAISED_STD,
                        transform: pressedBtn === `edit_${tx.id}` ? 'scale(0.96)' : 'scale(1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        color: '#4a90d9', fontSize: '12px', fontWeight: 600,
                        transition: 'box-shadow 0.07s, transform 0.07s',
                      }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    {confirming ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (pendingDeleteRef.current && deleteTimerRef.current) {
                              clearTimeout(deleteTimerRef.current);
                              removeTx({ txId: pendingDeleteRef.current.id as Id<'transactions'> }).catch(console.error);
                            }
                            const { id, orderNumber } = tx;
                            setPendingDelete({ id, orderNumber });
                            deleteTimerRef.current = setTimeout(() => {
                              removeTx({ txId: id as Id<'transactions'> }).catch(console.error);
                              setPendingDelete(null);
                              deleteTimerRef.current = null;
                            }, 5000);
                            setDeleteConfirm(null);
                            setExpandedId(null);
                          }}
                          onPointerDown={() => setPressedBtn(`conf_${tx.id}`)}
                          onPointerUp={() => setPressedBtn(null)}
                          onPointerLeave={() => setPressedBtn(null)}
                          style={{
                            flex: 1, height: 44, borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: '#d4183d', color: '#fff', fontSize: '12px', fontWeight: 700,
                            boxShadow: pressedBtn === `conf_${tx.id}` ? SHD_ACTION_PRESS : SHD_ACTION_RAISED,
                            transform: pressedBtn === `conf_${tx.id}` ? 'scale(0.96)' : 'scale(1)',
                            transition: 'box-shadow 0.07s, transform 0.07s',
                          }}
                        >
                          Hapus?
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                          onPointerDown={() => setPressedBtn(`canc_${tx.id}`)}
                          onPointerUp={() => setPressedBtn(null)}
                          onPointerLeave={() => setPressedBtn(null)}
                          aria-label="Batalkan"
                          style={{
                            width: 44, height: 44, borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: '#eef0f5',
                            boxShadow: pressedBtn === `canc_${tx.id}` ? SHD_RECESSED : SHD_RAISED_STD,
                            transform: pressedBtn === `canc_${tx.id}` ? 'scale(0.96)' : 'scale(1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'box-shadow 0.07s, transform 0.07s',
                          }}
                        >
                          <X size={14} color="#9a9db5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(tx.id); }}
                        onPointerDown={() => setPressedBtn(`del_${tx.id}`)}
                        onPointerUp={() => setPressedBtn(null)}
                        onPointerLeave={() => setPressedBtn(null)}
                        style={{
                          flex: 1, height: 44, borderRadius: '10px', border: 'none', cursor: 'pointer',
                          background: '#eef0f5',
                          boxShadow: pressedBtn === `del_${tx.id}` ? SHD_RECESSED : SHD_RAISED_STD,
                          transform: pressedBtn === `del_${tx.id}` ? 'scale(0.96)' : 'scale(1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          color: '#d4183d', fontSize: '12px', fontWeight: 600,
                          transition: 'box-shadow 0.07s, transform 0.07s',
                        }}
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', padding: '16px var(--app-page-gutter) 8px', gap: 0 }}>
      <style>{`
        @keyframes cal-modal-in {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes tx-expand-in {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes filter-panel-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sheets-sync-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes skel-pulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
      {showPriceEditor && <PriceEditorModal onClose={() => setShowPriceEditor(false)} />}
      {printingTx && (
        <ReceiptPreviewModal tx={printingTx} onClose={() => setPrintingTx(null)} />
      )}
      {editingTx && (
        <EditModal
          transaction={editingTx}
          members={members}
          plasticVariants={plasticVariants}
          onClose={() => setEditingTx(null)}
          onSave={(items, remarks, discount, memberId) => {
            const originalIds = new Set(editingTx.items.map(i => i.id));
            const newIds      = new Set(items.map(i => i.id));
            const removedItemIds = [...originalIds].filter(id => !newIds.has(id));
            updateTx({
              txId: editingTx.id as Id<'transactions'>,
              updatedItems: items.map(i => ({
                id: i.id as Id<'transactionItems'>,
                quantity: i.quantity,
                totalAmount: i.total,
                variantId: i.variantId as Id<'productVariants'> | undefined,
              })),
              removedItemIds: removedItemIds as Id<'transactionItems'>[],
              remarks: remarks || undefined,
              memberId: memberId as Id<'members'> | undefined,
              discount,
            }).catch(console.error);
            const txId = editingTx.id;
            if (savedIdTimerRef.current) clearTimeout(savedIdTimerRef.current);
            setSavedId(txId);
            savedIdTimerRef.current = setTimeout(() => setSavedId(null), 1200);
          }}
        />
      )}

      <div style={{ marginBottom: 8 }}>
        <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <DateNavigator selectedDate={selectedDate} onChange={d => { setSelectedDate(d); setExpandedId(null); }} />
      </div>

      {/* Day Summary Carousel */}
      {isDateLoading ? (
        <div style={{
          background: '#eef0f5', boxShadow: SHD_RAISED_STRONG,
          borderRadius: '16px', marginBottom: 20, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'stretch', padding: '12px 0 10px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 14px', gap: 8 }}>
              <SkelBox h={9} r={5} w="48%" />
              <SkelBox h={20} r={6} w="72%" />
            </div>
            <div style={{ width: 1, background: 'rgba(200,202,209,0.6)', flexShrink: 0, margin: '8px 0' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14, padding: '0 12px' }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <SkelBox h={8} r={4} w="55%" />
                <SkelBox h={14} r={5} w="38%" />
              </div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <SkelBox h={8} r={4} w="55%" />
                <SkelBox h={14} r={5} w="38%" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 6 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i === 0 ? 16 : 5, height: 5, borderRadius: 3, background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
      ) : (
      <div
        style={{
          background: '#eef0f5', boxShadow: SHD_RAISED_STRONG,
          borderRadius: '16px', marginBottom: 20,
          overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none',
        }}
        onPointerDown={e => {
          dragRef.current = { start: e.clientX, delta: 0 };
          if (trackRef.current) trackRef.current.style.transition = 'none';
        }}
        onPointerMove={e => {
          if (!dragRef.current || !trackRef.current) return;
          const raw = e.clientX - dragRef.current.start;
          const atEdge = (raw < 0 && summarySlide === 2) || (raw > 0 && summarySlide === 0);
          dragRef.current.delta = atEdge ? raw / 3 : raw;
          trackRef.current.style.transform = `translateX(calc(-${(summarySlide * 100 / 3).toFixed(4)}% + ${dragRef.current.delta}px))`;
        }}
        onPointerUp={() => {
          if (!dragRef.current) return;
          const { delta } = dragRef.current;
          dragRef.current = null;
          if (trackRef.current) trackRef.current.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
          if (Math.abs(delta) > 40)
            setSummarySlide(s => delta < 0 ? Math.min(2, s + 1) : Math.max(0, s - 1));
        }}
        onPointerLeave={() => {
          if (!dragRef.current) return;
          dragRef.current = null;
          if (trackRef.current) {
            trackRef.current.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
            trackRef.current.style.transform = `translateX(-${(summarySlide * 100 / 3).toFixed(4)}%)`;
          }
        }}
      >
        {/* Slides track — 300% wide, 3 slides */}
        <div ref={trackRef} style={{
          display: 'flex', width: '300%',
          transform: `translateX(-${(summarySlide * 100 / 3).toFixed(4)}%)`,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}>
          {/* Slide 1: Total + Stats */}
          <div style={{ width: 'calc(100% / 3)', padding: '12px 0 10px', boxSizing: 'border-box', display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 14px', minWidth: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                {isSameDay(selectedDate, new Date()) ? 'Hari Ini' : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#2d3142', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {formatRupiah(rawDayTotal)}
              </div>
            </div>
            <div style={{ width: 1, background: 'rgba(200,202,209,0.6)', flexShrink: 0, margin: '8px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 15, padding: '0 12px', flex: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Transaksi</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142', lineHeight: 1 }}>{transactions.length}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Rata-rata</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142', lineHeight: 1 }}>
                  {transactions.length > 0 ? formatRupiah(Math.round(rawDayTotal / transactions.length)) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Slide 2: Top 3 Items */}
          <div style={{ width: 'calc(100% / 3)', padding: '16px 18px 12px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Terlaris
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {summaryStats.top3.length === 0
                ? <span style={{ fontSize: '12px', color: '#c0c4d0' }}>—</span>
                : summaryStats.top3.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#c0c4d0', width: 12, flexShrink: 0, textAlign: 'right' }}>{idx + 1}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#9a9db5', flexShrink: 0 }}>
                      {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(1)} {item.unit}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Slide 3: Export */}
          <div style={{ width: 'calc(100% / 3)', padding: '14px 16px 12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Export
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <button
                  aria-label="Sinkron ke Google Sheets"
                  title={sheetsSyncError ?? (sheetsSyncState === 'done' ? 'Tersinkron' : 'Sinkron ke Google Sheets')}
                  disabled={sheetsSyncState === 'syncing'}
                  onClick={e => { e.stopPropagation(); handleSheetsSync(); }}
                  onPointerDown={() => setPressedBtn('slide3_sync')}
                  onPointerUp={() => setPressedBtn(null)}
                  onPointerLeave={() => setPressedBtn(null)}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none',
                    cursor: sheetsSyncState === 'syncing' ? 'default' : 'pointer',
                    background: '#eef0f5',
                    boxShadow: pressedBtn === 'slide3_sync' || sheetsSyncState === 'syncing' ? SHD_RECESSED : SHD_RAISED_STD,
                    transform: pressedBtn === 'slide3_sync' ? 'scale(0.93)' : 'scale(1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'box-shadow 0.07s, transform 0.07s',
                  }}
                >
                  {sheetsSyncState === 'syncing' ? (
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid #c0c4d0', borderTopColor: '#34a853',
                      animation: 'sheets-sync-spin 0.7s linear infinite',
                    }} />
                  ) : sheetsSyncState === 'done' ? (
                    <Check size={14} color="#52b96a" />
                  ) : (
                    <FileSpreadsheet size={14} color={sheetsSyncState === 'error' ? '#d4183d' : '#34a853'} />
                  )}
                </button>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.03em' }}>Sheets</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <button
                  aria-label="Ekspor CSV"
                  onClick={e => { e.stopPropagation(); exportCSV(transactions, selectedDate); }}
                  onPointerDown={() => setPressedBtn('slide3_csv')}
                  onPointerUp={() => setPressedBtn(null)}
                  onPointerLeave={() => setPressedBtn(null)}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: pressedBtn === 'slide3_csv' ? SHD_RECESSED : SHD_RAISED_STD,
                    transform: pressedBtn === 'slide3_csv' ? 'scale(0.93)' : 'scale(1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'box-shadow 0.07s, transform 0.07s',
                  }}
                >
                  <FileDown size={14} color="#4a90d9" />
                </button>
                <span style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.03em' }}>CSV</span>
              </div>
            </div>
          </div>
        </div>

        {/* Slide indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, paddingBottom: 6, paddingTop: 0 }}>
          {[0, 1, 2].map(i => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              aria-current={summarySlide === i ? 'true' : undefined}
              onClick={e => { e.stopPropagation(); setSummarySlide(i); }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '10px 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                width: summarySlide === i ? 16 : 5, height: 5,
                borderRadius: '3px',
                background: summarySlide === i ? '#4a90d9' : '#c0c4d0',
                transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s',
              }} />
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Search + Filter */}
      <div ref={searchRef} style={{ position: 'relative', marginBottom: 8 }}>
        <Search aria-hidden={true} size={14} color="#9a9db5" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          aria-label="Cari transaksi"
          placeholder="Cari order, produk, jumlah, catatan..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#eef0f5',
            boxShadow: SHD_RECESSED,
            borderRadius: '12px', border: 'none', outline: 'none',
            padding: '11px 60px 11px 36px',
            fontSize: '13px', color: '#2d3142',
          }}
        />
        {searchQuery && (
          <button aria-label="Hapus pencarian" onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}>
            <X size={13} color="#9a9db5" />
          </button>
        )}
        <button
          aria-label={filterOpen ? 'Tutup filter' : 'Tampilkan filter'}
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(o => !o)}
          onPointerDown={() => setFilterBtnPressed(true)}
          onPointerUp={() => setFilterBtnPressed(false)}
          onPointerLeave={() => setFilterBtnPressed(false)}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }}
        >
          <SlidersHorizontal
            size={15}
            color={activeFilters.size > 0 ? '#4a90d9' : '#9a9db5'}
            style={{
              transform: filterBtnPressed ? 'scale(0.82)' : 'scale(1)',
              transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </button>

        {filterOpen && (
          <div
            role="group"
            aria-label="Filter jenis produk"
            style={{
              position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 50,
              width: 148,
              background: '#eef0f5', borderRadius: '11px',
              boxShadow: SHD_CALENDAR,
              padding: '7px',
              animation: 'filter-panel-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            {([
              { key: 'soybean' as const, label: 'Kedelai', color: '#52b96a' },
              { key: 'plastic' as const, label: 'Plastik', color: '#4a90d9' },
              { key: 'other'   as const, label: 'Lainnya', color: '#9a9db5' },
            ]).map((opt, i) => {
              const checked = activeFilters.has(opt.key);
              return (
                <button
                  key={opt.key}
                  aria-pressed={checked}
                  onClick={() => toggleFilter(opt.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: '#eef0f5',
                    boxShadow: checked ? SHD_RECESSED : 'none',
                    marginBottom: i < 2 ? 3 : 0,
                    transition: 'box-shadow 0.1s',
                  }}
                >
                  <div style={{
                    width: 13, height: 13, borderRadius: '4px', flexShrink: 0,
                    background: '#eef0f5',
                    boxShadow: checked ? 'inset 1.5px 1.5px 3px #c0c3ca, inset -1.5px -1.5px 3px #fff' : '1.5px 1.5px 3px #c8cad1, -1.5px -1.5px 3px #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <Check size={8} color="#4a90d9" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: checked ? '#2d3142' : '#9a9db5', flex: 1, textAlign: 'left' }}>
                    {opt.label}
                  </span>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: checked ? opt.color : 'transparent', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Soft-delete undo toast */}
      {pendingDelete && (
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{ background: '#eef0f5', boxShadow: SHD_RAISED_STD, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, animation: 'toast-in 180ms cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <Trash2 size={13} color="#c0c4d0" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '12px', color: '#9a9db5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Order #{pendingDelete.orderNumber} dihapus
          </span>
          <button
            onClick={handleUndoDelete}
            style={{ height: 40, padding: '0 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED_STD, color: '#4a90d9', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}
          >
            Urungkan
          </button>
        </div>
      )}

      {/* Transaction List */}
      {isDateLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          {[76, 60, 76, 60, 60].map((h, i) => <SkelBox key={i} h={h} r={16} />)}
        </div>
      ) : renderTxList()}

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
