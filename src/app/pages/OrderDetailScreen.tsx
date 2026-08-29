import React, { useState, useEffect, useRef } from 'react';
import { tap } from '../../utils/haptics';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { formatRupiah } from '../store';
import { ArrowLeft, CreditCard, Plus, Check, X, Trash2, MoreVertical, Pencil } from 'lucide-react';

const SHD_RAISED = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RECESSED = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';

function today() { return new Date().toISOString().slice(0, 10); }

type PaymentEntry = { id: Id<'payments'>; date: string; amount: number };

/**
 * Payment row whose three-dot button opens the action sheet.
 *
 * The actions live in a bottom sheet rather than an inline popover: the
 * payments card uses overflow:hidden for its rounded corners, which clips any
 * absolutely-positioned child.
 * The initial "Saat Pembelian" row is deliberately not one of these — that
 * amount lives on the transaction, not the payments table.
 */
function PaymentRow({
  payment,
  isLast,
  onOpenMenu,
}: {
  payment: PaymentEntry;
  isLast: boolean;
  onOpenMenu: () => void;
}) {
  return (
    <div style={{ padding: '11px 14px', borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>Pembayaran</div>
        <div style={{ fontSize: '11px', color: '#9a9db5', marginTop: 1 }}>{payment.date}</div>
      </div>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#52b96a' }}>{formatRupiah(payment.amount)}</span>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); tap(); onOpenMenu(); }}
          aria-label={`Opsi untuk pembayaran ${formatRupiah(payment.amount)}`}
          style={{ width: 32, height: 32, borderRadius: '9px', border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <MoreVertical size={14} color="#9a9db5" />
        </button>
      </div>
    </div>
  );
}

function PaymentActionSheet({
  payment,
  onEdit,
  onDelete,
  onClose,
}: {
  payment: PaymentEntry;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const item: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: '#eef0f5', boxShadow: SHD_RAISED, fontSize: '14px',
    fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', zIndex: 240, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#eef0f5', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 430, boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', padding: '20px 16px 24px', animation: 'sheet-up 250ms cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 2 }}>PEMBAYARAN</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(payment.amount)}</div>
        <div style={{ fontSize: '11px', color: '#9a9db5', marginBottom: 16 }}>{payment.date}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => { tap(); onEdit(); }} style={{ ...item, color: '#2d3142' }}>
            <Pencil size={15} color="#9a9db5" /> Ubah
          </button>
          <button onClick={() => { tap(); onDelete(); }} style={{ ...item, color: '#d4183d' }}>
            <Trash2 size={15} color="#d4183d" /> Hapus
          </button>
          <button
            onClick={onClose}
            style={{ ...item, color: '#9a9db5', justifyContent: 'center', boxShadow: 'none', background: 'transparent', marginTop: 2, padding: '10px 16px' }}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function DeletePaymentConfirm({
  payment,
  onConfirm,
  onClose,
}: {
  payment: PaymentEntry;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', zIndex: 250, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 18, padding: '20px 18px', width: '100%', maxWidth: 320 }}
      >
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#2d3142', marginBottom: 6 }}>Hapus pembayaran?</div>
        <div style={{ fontSize: '12px', color: '#9a9db5', lineHeight: 1.5, marginBottom: 16 }}>
          Pembayaran {formatRupiah(payment.amount)} tanggal {payment.date} akan dihapus.
          Sisa hutang akan bertambah kembali sebesar jumlah ini.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED, color: '#4a4e69', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit' }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#d4183d', boxShadow: SHD_ACTION, color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit' }}
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({
  remaining,
  onSave,
  onClose,
  mode = 'create',
  initialAmount,
  initialDate,
}: {
  /** Largest amount this payment may be. When editing, the payment's own
   *  amount is added back in, since it is already counted in the balance. */
  remaining: number;
  onSave: (amount: number, date: string) => void;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialAmount?: number;
  initialDate?: string;
}) {
  const isEdit = mode === 'edit';
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : ''); // raw digits only
  const [date, setDate] = useState(initialDate ?? today());
  const [pressed, setPressed] = useState(false);

  const parsed = Number(amount) || 0;
  const clamped = Math.min(parsed, remaining);
  const valid = clamped > 0;

  return (
    <div
      style={{ position: 'fixed', left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#eef0f5', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 430, boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', padding: '20px 16px 32px', animation: 'sheet-up 250ms cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.1em', marginBottom: 2 }}>{isEdit ? 'UBAH' : 'CATAT'}</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142', marginBottom: 4 }}>Pembayaran</div>
        <div style={{ fontSize: '11px', color: '#9a9db5', marginBottom: 16 }}>
          {isEdit ? 'Maks' : 'Sisa'}: {formatRupiah(remaining)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9a9db5', fontWeight: 600, pointerEvents: 'none' }}>Rp</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Jumlah pembayaran"
              value={amount ? Number(amount).toLocaleString('id-ID') : ''}
              onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', background: '#eef0f5', boxShadow: SHD_RECESSED, borderRadius: 12, border: 'none', outline: 'none', padding: '11px 12px 11px 34px', fontSize: '14px', color: '#2d3142', fontFamily: 'inherit' }}
            />
            <button
              onClick={() => setAmount(String(remaining))}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: '#4a90d922', border: 'none', borderRadius: 7, padding: '3px 8px', fontSize: '11px', fontWeight: 700, color: '#4a90d9', cursor: 'pointer', lineHeight: 1.4 }}
            >
              Penuh
            </button>
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: '#eef0f5', boxShadow: SHD_RECESSED, borderRadius: 12, border: 'none', outline: 'none', padding: '11px 12px', fontSize: '14px', color: '#2d3142', fontFamily: 'inherit' }}
          />
          {parsed > remaining && (
            <div style={{ fontSize: '11px', color: '#d4a017' }}>
              Jumlah melebihi {isEdit ? 'batas' : 'sisa'} — akan dicatat sebagai {formatRupiah(remaining)}
            </div>
          )}
          <button
            onClick={() => { if (valid) { onSave(clamped, date); onClose(); } }}
            disabled={!valid}
            onPointerDown={() => { tap(); setPressed(true); }}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            style={{ height: 48, borderRadius: 14, border: 'none', cursor: valid ? 'pointer' : 'default', background: valid ? '#4a90d9' : '#a8acbe', color: '#fff', fontWeight: 700, fontSize: '14px', boxShadow: pressed && valid ? 'inset 3px 3px 8px rgba(0,0,0,0.22)' : SHD_ACTION, transform: pressed && valid ? 'scale(0.97)' : 'scale(1)', transition: 'box-shadow 0.07s, transform 0.07s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Check size={15} /> {isEdit ? 'Simpan Perubahan' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
      <style>{`@keyframes sheet-up { from { transform:translateY(100%); } to { transform:translateY(0); } }`}</style>
    </div>
  );
}

function OrderDetailSkeleton({ onBack }: { onBack: () => void }) {
  const S: React.CSSProperties = { background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite', borderRadius: 5, flexShrink: 0 };
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '16px var(--app-page-gutter) 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ArrowLeft size={16} color="#4a4e69" />
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ ...S, height: 9, width: '30%' }} />
          <div style={{ ...S, height: 18, width: '45%', animationDelay: '0.07s' }} />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 var(--app-page-gutter) var(--app-content-bottom)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Summary card */}
        <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['32%', '25%', '20%'] as const).map((lw, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ ...S, height: 12, width: lw, animationDelay: `${i * 0.07}s` }} />
              <div style={{ ...S, height: i === 2 ? 16 : 13, width: ['22%', '18%', '24%'][i], animationDelay: `${i * 0.07}s` }} />
            </div>
          ))}
        </div>
        {/* Items */}
        <div>
          <div style={{ ...S, height: 9, width: '18%', marginBottom: 8 }} />
          <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
            {[0, 1].map(i => (
              <div key={i} style={{ padding: '11px 14px', borderBottom: i === 0 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ ...S, height: 13, width: ['52%', '38%'][i], animationDelay: `${i * 0.08}s` }} />
                  <div style={{ ...S, height: 10, width: ['38%', '28%'][i], animationDelay: `${i * 0.08 + 0.08}s` }} />
                </div>
                <div style={{ ...S, height: 13, width: '20%', animationDelay: `${i * 0.08}s` }} />
              </div>
            ))}
          </div>
        </div>
        {/* Payment history */}
        <div>
          <div style={{ ...S, height: 9, width: '36%', marginBottom: 8 }} />
          <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ ...S, height: 12, width: 80 }} />
              <div style={{ ...S, height: 10, width: 60, animationDelay: '0.1s' }} />
            </div>
            <div style={{ ...S, height: 13, width: 70 }} />
          </div>
        </div>
      </div>
      <style>{`@keyframes skel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }`}</style>
    </div>
  );
}

export default function OrderDetailScreen() {
  const { txId } = useParams<{ txId: string }>();
  const navigate = useNavigate();
  const detail = useQuery(api.transactions.getDetail, txId ? { txId: txId as Id<'transactions'> } : 'skip');
  const recordPayment = useMutation(api.payments.record);
  const removePayment = useMutation(api.payments.remove);
  const updatePayment = useMutation(api.payments.update);
  const [confirmPayment, setConfirmPayment] = useState<PaymentEntry | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [paymentMenu, setPaymentMenu] = useState<PaymentEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLunas, setShowLunas] = useState(false);
  const prevBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    const balance = detail?.balance;
    if (balance === undefined || balance === null) return;
    if (prevBalanceRef.current !== null && prevBalanceRef.current > 0 && balance <= 0) {
      setShowLunas(true);
      prevBalanceRef.current = balance;
      const t = setTimeout(() => setShowLunas(false), 2500);
      return () => clearTimeout(t);
    }
    prevBalanceRef.current = balance;
  }, [detail?.balance]);

  if (detail === undefined) return <OrderDetailSkeleton onBack={() => navigate(-1)} />;
  if (!detail) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '13px', color: '#9a9db5' }}>Transaksi tidak ditemukan</span>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a90d9', fontSize: '13px', fontWeight: 600 }}>Kembali</button>
      </div>
    );
  }

  const totalPaid = detail.amountPaid + detail.payments.reduce((s, p) => s + p.amount, 0);
  const isFullyPaid = detail.balance <= 0;

  const handleSavePayment = (amount: number, date: string) => {
    recordPayment({ transactionId: detail.id, date, amount }).catch(console.error);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes lunas-bg   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lunas-card { from { opacity: 0; transform: scale(0.72); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {showLunas && (
        <div
          onClick={() => setShowLunas(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'lunas-bg 250ms ease both' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#eef0f5', borderRadius: 24, padding: '34px 48px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.22)', animation: 'lunas-card 380ms cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#52b96a1a', boxShadow: '4px 4px 10px #c8cad1, -4px -4px 10px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Check size={34} color="#52b96a" strokeWidth={2.5} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#52b96a', letterSpacing: '-0.02em' }}>Lunas!</div>
            <div style={{ fontSize: '12px', color: '#9a9db5', marginTop: 6 }}>Utang telah dilunasi</div>
          </div>
        </div>
      )}

      {showModal && (
        <RecordPaymentModal
          remaining={detail.balance}
          onSave={handleSavePayment}
          onClose={() => setShowModal(false)}
        />
      )}

      {paymentMenu && (
        <PaymentActionSheet
          payment={paymentMenu}
          onClose={() => setPaymentMenu(null)}
          onEdit={() => { setEditingPayment(paymentMenu); setPaymentMenu(null); }}
          onDelete={() => { setConfirmPayment(paymentMenu); setPaymentMenu(null); }}
        />
      )}

      {editingPayment && (
        <RecordPaymentModal
          mode="edit"
          initialAmount={editingPayment.amount}
          initialDate={editingPayment.date}
          // This payment is already deducted from the balance, so add it back
          // to get the true ceiling for the edited amount.
          remaining={detail.balance + editingPayment.amount}
          onSave={(amount, date) => { void updatePayment({ paymentId: editingPayment.id, amount, date }); }}
          onClose={() => setEditingPayment(null)}
        />
      )}

      {confirmPayment && (
        <DeletePaymentConfirm
          payment={confirmPayment}
          onClose={() => setConfirmPayment(null)}
          onConfirm={() => {
            tap();
            void removePayment({ paymentId: confirmPayment.id });
            setConfirmPayment(null);
          }}
        />
      )}

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px var(--app-page-gutter) 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <ArrowLeft size={16} color="#4a4e69" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em' }}>PESANAN #{detail.orderNumber}</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#2d3142', lineHeight: 1.2 }}>{detail.date}</div>
          {detail.memberName && <div style={{ fontSize: '11px', color: '#4a90d9', marginTop: 1 }}>{detail.memberName}</div>}
        </div>
        {!isFullyPaid && (
          <div style={{ background: '#d4a01722', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#d4a017', fontWeight: 700 }}>Belum Lunas</span>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 var(--app-page-gutter) var(--app-content-bottom)', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Summary card */}
        <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '14px 16px' }}>
          {detail.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '11px', color: '#d4183d' }}>Diskon</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#d4183d' }}>−{formatRupiah(detail.discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '12px', color: '#9a9db5', fontWeight: 600 }}>Total</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(detail.total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '11px', color: '#9a9db5' }}>Sudah Dibayar</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#52b96a' }}>{formatRupiah(totalPaid)}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: isFullyPaid ? '#52b96a' : '#d4a017' }}>
              {isFullyPaid ? 'Lunas ✓' : 'Sisa'}
            </span>
            {!isFullyPaid && <span style={{ fontSize: '16px', fontWeight: 800, color: '#d4a017' }}>{formatRupiah(detail.balance)}</span>}
          </div>
        </div>

        {/* Items */}
        <div>
          <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>PRODUK</div>
          <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
            {detail.items.map((item, i) => (
              <div key={item.id} style={{ padding: '11px 14px', borderBottom: i < detail.items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName}</div>
                  <div style={{ fontSize: '11px', color: '#9a9db5', marginTop: 2 }}>
                    {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)} {item.unit} × {formatRupiah(item.unitPrice)}
                  </div>
                  {item.currentPrice !== item.unitPrice && (
                    <div style={{ fontSize: '10px', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color: '#b0b3c8' }}>kini</span>
                      <span style={{ fontWeight: 600, color: item.currentPrice > item.unitPrice ? '#52b96a' : '#d4183d' }}>
                        {formatRupiah(item.currentPrice)} {item.currentPrice > item.unitPrice ? '↑' : '↓'}
                      </span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#4a4e69', flexShrink: 0 }}>{formatRupiah(item.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment history */}
        <div>
          <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>RIWAYAT PEMBAYARAN</div>
          <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
            {/* Initial payment at sale time */}
            <div style={{ padding: '11px 14px', borderBottom: detail.payments.length > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#2d3142' }}>Saat Pembelian</div>
                <div style={{ fontSize: '11px', color: '#9a9db5', marginTop: 1 }}>{detail.date}</div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: detail.amountPaid > 0 ? '#52b96a' : '#d4a017' }}>
                {detail.amountPaid > 0 ? formatRupiah(detail.amountPaid) : 'Belum dibayar'}
              </span>
            </div>
            {detail.payments.map((p, i) => (
              <PaymentRow
                key={p.id}
                payment={p}
                isLast={i === detail.payments.length - 1}
                onOpenMenu={() => setPaymentMenu(p)}
              />
            ))}
            {detail.payments.length === 0 && detail.amountPaid <= 0 && (
              <div style={{ padding: '11px 14px' }}>
                <span style={{ fontSize: '12px', color: '#c0c4d0' }}>Belum ada pembayaran</span>
              </div>
            )}
          </div>
        </div>

        {/* Record payment button */}
        {!isFullyPaid && (
          <button
            onClick={() => setShowModal(true)}
            style={{ height: 50, borderRadius: 14, border: 'none', cursor: 'pointer', background: '#4a90d9', color: '#fff', fontWeight: 700, fontSize: '14px', boxShadow: SHD_ACTION, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Plus size={16} /> Catat Pembayaran
          </button>
        )}

        {detail.remarks && (
          <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>CATATAN</div>
            <span style={{ fontSize: '12px', color: '#4a4e69', fontStyle: 'italic' }}>{detail.remarks}</span>
          </div>
        )}
      </div>
    </div>
  );
}
