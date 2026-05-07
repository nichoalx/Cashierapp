import { useState, useRef, useEffect, useMemo } from 'react';
import { Pencil, Trash2, X, Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, MessageSquare, User, Receipt } from 'lucide-react';
import { useAppStore, formatRupiah, Transaction, TransactionItem } from '../store';
import { PriceTicker } from '../components/PriceTicker';
import { PriceEditorModal } from '../components/PriceEditorModal';

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

const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

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
    <div style={{
      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
      marginTop: 8, zIndex: 100,
      background: '#eef0f5', borderRadius: '18px',
      boxShadow: SHD_CALENDAR,
      padding: '14px', width: 280,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a9db5' }}>
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
                transition: 'all 0.12s',
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
  );
}

function DateNavigator({ selectedDate, onChange }: { selectedDate: Date; onChange: (d: Date) => void }) {
  const [calOpen, setCalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpen]);

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
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={prevDay}
        style={{
          background: '#eef0f5', boxShadow: SHD_RAISED_STD,
          border: 'none', borderRadius: '10px', cursor: 'pointer',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <ChevronLeft size={15} color="#9a9db5" />
      </button>

      <button
        onClick={() => setCalOpen(o => !o)}
        style={{
          flex: 1,
          background: '#eef0f5',
          boxShadow: calOpen ? SHD_RECESSED : SHD_RAISED_STD,
          border: 'none', borderRadius: '10px', cursor: 'pointer',
          padding: '8px 12px',
          fontSize: '13px', fontWeight: 700, color: '#2d3142',
          transition: 'box-shadow 0.15s',
        }}
      >
        {label}
      </button>

      <button
        onClick={nextDay}
        style={{
          background: '#eef0f5', boxShadow: SHD_RAISED_STD,
          border: 'none', borderRadius: '10px', cursor: 'pointer',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <ChevronRight size={15} color="#9a9db5" />
      </button>

      {calOpen && (
        <MiniCalendar
          selectedDate={selectedDate}
          onSelect={onChange}
          onClose={() => setCalOpen(false)}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: (items: TransactionItem[]) => void;
}

function EditModal({ transaction, onClose, onSave }: EditModalProps) {
  const [items, setItems]       = useState<TransactionItem[]>(transaction.items.map(i => ({ ...i })));
  const [savePressed, setSavePressed] = useState(false);

  const updateQty  = (id: string, val: string) => {
    const qty = parseFloat(val) || 0;
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty, total: qty * i.unitPrice } : i));
  };
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const newTotal   = items.reduce((s, i) => s + i.total, 0);

  return (
    <>
      <style>{`
        @keyframes edit-sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#eef0f5',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 430, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'edit-sheet-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Edit</div>
            <h3 style={{ margin: '2px 0 0', color: '#2d3142', fontSize: '18px', fontWeight: 700 }}>Order #{transaction.orderNumber}</h3>
          </div>
          <button onClick={onClose} style={{
            background: '#eef0f5', boxShadow: SHD_RAISED_STD,
            border: 'none', borderRadius: '11px', width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={16} color="#9a9db5" />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
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
              <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#e05a6a', cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: '13px', color: '#9a9db5' }}>Total Baru</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(newTotal)}</span>
          </div>
          <button
            onClick={() => { onSave(items); onClose(); }}
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
    </>
  );
}

export default function TransactionLogScreen() {
  const { transactions, deleteTransaction, updateTransaction } = useAppStore();
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [editingTx, setEditingTx]             = useState<Transaction | null>(null);
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]     = useState<string | null>(null);
  const [selectedDate, setSelectedDate]       = useState(new Date());
  const [searchQuery, setSearchQuery]         = useState('');
  const [filterType, setFilterType]           = useState<'all' | 'soybean' | 'plastic' | 'other'>('all');

  const SOYBEAN_IDS = ['mrb', 'sbs', 'bh', 'e'];
  const PLASTIC_ID  = 'plastic';
  const OTHER_IDS   = ['tempe', 'dages'];

  const dayTxs = transactions.filter(t => isSameDay(t.timestamp, selectedDate));

  const filteredTxs = useMemo(() => {
    let list = dayTxs;
    if (filterType !== 'all') {
      list = list.filter(t => {
        if (filterType === 'soybean') return t.items.some(i => SOYBEAN_IDS.includes(i.productId));
        if (filterType === 'plastic') return t.items.some(i => i.productId === PLASTIC_ID);
        if (filterType === 'other')   return t.items.some(i => OTHER_IDS.includes(i.productId));
        return true;
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
  }, [dayTxs, filterType, searchQuery]);

  const dayTotal    = filteredTxs.reduce((s, t) => s + t.total, 0);
  const rawDayTotal = dayTxs.reduce((s, t) => s + t.total, 0);

  const filterChips: { key: typeof filterType; label: string }[] = [
    { key: 'all',     label: 'Semua'   },
    { key: 'soybean', label: 'Kedelai' },
    { key: 'plastic', label: 'Plastik' },
    { key: 'other',   label: 'Lainnya' },
  ];

  const renderTxList = () => (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      margin: '0 -8px',
      padding: '4px 8px 80px',
    }}>
      {filteredTxs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px' }}>
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
              background: '#eef0f5', boxShadow: SHD_RAISED_LIST,
              borderRadius: '16px', overflow: 'hidden',
              transition: 'all 0.2s',
            }}>
              {/* Row */}
              <div
                style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => setExpandedId(expanded ? null : tx.id)}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '10px', background: '#eef0f5',
                  boxShadow: SHD_RECESSED,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a90d9' }}>#{tx.orderNumber}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
                    {tx.items.map((item, i) => (
                      <span key={i} style={{
                        fontSize: '10px', fontWeight: 600, color: item.color,
                        background: `${item.color}18`, borderRadius: '5px', padding: '1px 5px',
                      }}>
                        {item.productShortName}{item.plasticSize ? ` ${item.plasticSize}` : ''}
                      </span>
                    ))}
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
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(tx.total)}</span>
                  </div>
                </div>

                {expanded ? <ChevronUp size={14} color="#9a9db5" /> : <ChevronDown size={14} color="#9a9db5" />}
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div style={{ padding: '2px 14px 10px' }}>
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
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}
                      style={{
                        flex: 1, height: 36, borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: '#eef0f5', boxShadow: SHD_RAISED_STD,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        color: '#4a90d9', fontSize: '12px', fontWeight: 600,
                      }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    {confirming ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTransaction(tx.id); setDeleteConfirm(null); setExpandedId(null); }}
                          style={{ flex: 1, height: 36, borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#d4183d', color: '#fff', fontSize: '12px', fontWeight: 700 }}
                        >
                          Hapus?
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                          style={{ width: 36, height: 36, borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED_STD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={14} color="#9a9db5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(tx.id); }}
                        style={{ flex: 1, height: 36, borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED_STD, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#e05a6a', fontSize: '12px', fontWeight: 600 }}
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
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 16px 8px', gap: 10 }}>
      {showPriceEditor && <PriceEditorModal onClose={() => setShowPriceEditor(false)} />}
      {editingTx && (
        <EditModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={(items) => updateTransaction(editingTx.id, items)}
        />
      )}

      <PriceTicker onOpenPriceEditor={() => setShowPriceEditor(true)} />

      <DateNavigator selectedDate={selectedDate} onChange={d => { setSelectedDate(d); setExpandedId(null); }} />

      {/* Day Summary */}
      <div style={{
        background: '#eef0f5', boxShadow: SHD_RAISED_STRONG,
        borderRadius: '16px', padding: '12px 16px',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Total {isSameDay(selectedDate, new Date()) ? 'Hari Ini' : MONTHS[selectedDate.getMonth()] + ' ' + selectedDate.getDate()}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#2d3142', lineHeight: 1.2 }}>
          {formatRupiah(searchQuery || filterType !== 'all' ? dayTotal : rawDayTotal)}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Transaksi</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#4a90d9' }}>
              {filteredTxs.length}{filteredTxs.length !== dayTxs.length ? `/${dayTxs.length}` : ''}
            </div>
          </div>
          {filteredTxs.length > 0 && (
            <div>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rata-rata</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#2d3142' }}>
                {formatRupiah(Math.round(dayTotal / filteredTxs.length))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#9a9db5" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Cari order, produk, jumlah, catatan..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#eef0f5',
              boxShadow: searchQuery ? SHD_RECESSED : SHD_RAISED_STD,
              borderRadius: '12px', border: 'none', outline: 'none',
              padding: '10px 36px',
              fontSize: '13px', color: '#2d3142',
              transition: 'box-shadow 0.15s',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={13} color="#9a9db5" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {filterChips.map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilterType(chip.key)}
              style={{
                flex: 1, padding: '6px 4px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                background: '#eef0f5',
                color: filterType === chip.key ? '#4a90d9' : '#9a9db5',
                boxShadow: filterType === chip.key ? SHD_RECESSED : SHD_RAISED_STD,
                transition: 'all 0.15s',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {renderTxList()}
    </div>
  );
}
