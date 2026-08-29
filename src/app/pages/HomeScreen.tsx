import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, MessageSquare, User, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { tap, softTap, confirmTap } from '../../utils/haptics';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useAppStore, formatRupiah, TransactionItem } from '../store';
import { useCompact } from '../hooks/useCompact';
import { Numpad } from '../components/Numpad';
import { MemberPickerModal } from '../components/MemberPickerModal';
import { computeShortages as computeShortagesPure, type Shortage } from '../../utils/stockGate';

type Step =
  | { type: 'idle' }
  | { type: 'plastic_size' }
  | { type: 'eceran_brand' }
  | { type: 'quantity'; productId: string; variantId?: string; productName: string; productShortName: string; unit: string; unitPrice: number; color: string; plasticSize?: string; isSoybean?: boolean; isEceran?: boolean };

function genId() { return Math.random().toString(36).slice(2, 10); }

const fmtQty = (n: number) =>
  n % 1 === 0 ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

const PLASTIC_COLOR = '#38b2ac';

// Remarks modal
function RemarksModal({ value, onSave, onClose }: {
  value: string;
  onSave: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const [savePressed, setSavePressed] = React.useState(false);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      style={{ position: 'fixed', left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
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
          maxLength={280}
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
          onPointerDown={() => { confirmTap(); setSavePressed(true); }}
          onPointerUp={() => setSavePressed(false)}
          onPointerLeave={() => setSavePressed(false)}
          style={{
            width: '100%', height: 48, borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: '#4a90d9',
            boxShadow: savePressed
              ? 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)'
              : '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)',
            transform: savePressed ? 'scale(0.97)' : 'scale(1)',
            transition: 'box-shadow 0.07s, transform 0.07s',
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
  const {
    cartItems: items, cartRemarks: remarks, cartMember: selectedMember,
    setCartItems, setCartRemarks, setCartMember,
  } = useAppStore();

  const rawProducts = useQuery(api.products.listWithPrices);
  const rawMembers  = useQuery(api.members.listBasic);
  const rawStock    = useQuery(api.stock.list);
  const createTx    = useMutation(api.transactions.create);

  // Live stock keyed by product/variant — used to gate transactions before commit
  const stockByKey = useMemo(() => {
    const m = new Map<string, { quantity: number; name: string; unit: string }>();
    (rawStock ?? []).forEach(s => {
      const key = s.variantId ? `v:${s.variantId}` : `p:${s.productId}`;
      m.set(key, { quantity: s.quantity, name: s.productShortName, unit: s.unit });
    });
    return m;
  }, [rawStock]);

  const soybeanProducts = useMemo(() =>
    (rawProducts ?? []).filter(p => p.unit === 'kg' && p.name !== 'E').map(p => ({
      id: p._id, name: p.name, fullName: p.fullName, color: p.color, price: p.price,
    })),
    [rawProducts]
  );
  const eceranPrice = useMemo(() =>
    (rawProducts ?? []).find(p => p.name === 'E')?.price ?? 0,
    [rawProducts]
  );
  const plasticProduct = useMemo(() =>
    (rawProducts ?? []).find(p => p.unit === 'pcs' && p.variants.length > 0),
    [rawProducts]
  );
  const plasticSizes = useMemo(() =>
    plasticProduct?.variants.map(v => ({ id: v._id, size: v.variantValue, price: v.price })) ?? [],
    [plasticProduct]
  );
  const otherProducts = useMemo(() =>
    (rawProducts ?? []).filter(p => p.unit === 'pcs' && p.variants.length === 0).map(p => ({
      id: p._id, name: p.name, fullName: p.fullName, color: p.color, price: p.price,
    })),
    [rawProducts]
  );
  const members = useMemo(() =>
    (rawMembers ?? []).map(m => ({
      id: m._id, name: m.name, phone: m.phone ?? '', createdAt: new Date(m._creationTime),
    })),
    [rawMembers]
  );
  const setItems = setCartItems;
  const setRemarks = setCartRemarks;
  const setSelectedMember = setCartMember;
  const [step, setStep] = useState<Step>({ type: 'idle' });
  const [inputValue, setInputValue] = useState('0');
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [pressedIcon, setPressedIcon] = useState<string | null>(null);
  const [pressedRemove, setPressedRemove] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState(false);
  const [discountInput, setDiscountInput] = useState('0');
  const [debtMode, setDebtMode] = useState(false);
  const [stockError, setStockError] = useState<Shortage[] | null>(null);
  const compact = useCompact();

  // Auto-clear kredit when member is deselected
  useEffect(() => {
    if (!selectedMember) setDebtMode(false);
  }, [selectedMember]);

  // Any change to the cart clears a stale insufficient-stock warning
  useEffect(() => { setStockError(null); }, [items]);

  // Compare aggregated cart quantities against live stock; returns any shortfalls.
  const computeShortages = useCallback(
    (cartItems: TransactionItem[]): Shortage[] => computeShortagesPure(cartItems, stockByKey),
    [stockByKey],
  );

  // Payment confirmation phase (after Selesai, before commit)
  type PayStash = { items: TransactionItem[]; remarks: string; memberId?: string; memberName?: string; discount: number };
  const [payPhase, setPayPhase] = useState<'idle' | 'payment' | 'success'>('idle');
  const [payStash, setPayStash] = useState<PayStash | null>(null);
  const [payIsDebt, setPayIsDebt] = useState(false);
  const [cashInput, setCashInput] = useState(''); // raw digits only
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appliedDiscount = parseFloat(discountInput) || 0;

  const selectedProduct = step.type === 'quantity' ? step : null;

  const handleInputChange = useCallback((val: string) => setInputValue(val), []);

  const handleEceranClick = useCallback(() => {
    if (step.type === 'eceran_brand' || (step.type === 'quantity' && step.isEceran)) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    setStep({ type: 'eceran_brand' });
    setInputValue('0');
  }, [step]);

  const handleSoybeanClick = useCallback((id: string) => {
    const p = soybeanProducts.find(x => x.id === id);
    if (!p) return;
    if (step.type === 'quantity' && step.productId === p.id) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    const isEceran = step.type === 'eceran_brand';
    setStep({ type: 'quantity', productId: p.id, productName: p.fullName, productShortName: p.name, unit: 'kg', unitPrice: p.price, color: p.color, isSoybean: true, isEceran });
    setInputValue('0');
  }, [soybeanProducts, step]);

  const handleOtherClick = useCallback((id: string) => {
    const p = otherProducts.find(x => x.id === id);
    if (!p) return;
    if (step.type === 'quantity' && step.productId === p.id) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    setStep({ type: 'quantity', productId: p.id, productName: p.fullName, productShortName: p.name, unit: 'pcs', unitPrice: p.price, color: p.color });
    setInputValue('0');
  }, [otherProducts, step]);

  const handlePlasticClick = useCallback(() => {
    if (step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic')) {
      setStep({ type: 'idle' }); setInputValue('0'); return;
    }
    setStep({ type: 'plastic_size' });
  }, [step]);

  const handlePlasticSizeClick = useCallback((sizeId: string) => {
    const ps = plasticSizes.find(x => x.id === sizeId);
    if (!ps) return;
    setStep({ type: 'quantity', productId: 'plastic', variantId: ps.id, productName: `Plastik ${ps.size}`, productShortName: 'P', unit: 'pcs', unitPrice: ps.price, color: PLASTIC_COLOR, plasticSize: ps.size });
    setInputValue('0');
  }, [plasticSizes]);

  const effectivePrice = selectedProduct
    ? (selectedProduct.isSoybean && selectedProduct.isEceran ? eceranPrice : selectedProduct.unitPrice)
    : 0;
  const computedTotal = selectedProduct ? effectivePrice * (parseFloat(inputValue) || 0) : 0;

  const handleAddItem = useCallback(() => {
    if (!selectedProduct || parseFloat(inputValue) <= 0) return;
    const qty = parseFloat(inputValue);
    const useEceran = !!(selectedProduct.isSoybean && selectedProduct.isEceran);
    const price = useEceran ? eceranPrice : selectedProduct.unitPrice;
    // For plastic, substitute the real Convex product ID; sentinel 'plastic' stays for UI toggle checks
    const resolvedProductId = selectedProduct.productId === 'plastic'
      ? (plasticProduct?._id ?? selectedProduct.productId)
      : selectedProduct.productId;
    const item: TransactionItem = {
      id: genId(),
      productId: resolvedProductId,
      variantId: selectedProduct.variantId,
      productName: useEceran ? `Eceran (${selectedProduct.productShortName})` : selectedProduct.productName,
      productShortName: useEceran ? 'E' : selectedProduct.productShortName,
      quantity: qty, unit: selectedProduct.unit,
      unitPrice: price,
      total: price * qty,
      color: useEceran ? '#9b6dff' : selectedProduct.color,
      plasticSize: selectedProduct.plasticSize,
    };
    setItems([...items, item]);
    setStep({ type: 'idle' });
    setInputValue('0');
  }, [selectedProduct, inputValue, items, eceranPrice, plasticProduct]);

  // Shared commit helper — does not touch phase state
  const commitStash = useCallback((stash: PayStash, amountPaid: number | undefined) => {
    createTx({
      items: stash.items.map(item => ({
        productId: item.productId as Id<'products'>,
        variantId: item.variantId as Id<'productVariants'> | undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.total,
        displayName: item.productShortName,
        displayColor: item.color,
      })),
      remarks: stash.remarks || undefined,
      memberId: stash.memberId as Id<'members'> | undefined,
      discount: stash.discount > 0 ? stash.discount : undefined,
      amountPaid,
    }).catch(console.error);
  }, [createTx]);

  const handleComplete = useCallback(() => {
    if (items.length === 0) return;

    // Stock safety gate — block the transaction if any product is short.
    // Cart is left intact so the operator can add stock or adjust quantities.
    const shortages = computeShortages(items);
    if (shortages.length > 0) {
      tap();
      setStockError(shortages);
      return;
    }

    const discountAmount = parseFloat(discountInput) || 0;
    const stash: PayStash = {
      items: [...items], remarks: remarks.trim(),
      memberId: selectedMember?.id, memberName: selectedMember?.name,
      discount: discountAmount,
    };
    const isDebt = debtMode;

    // Clear cart immediately regardless of path
    setItems([]);
    setStep({ type: 'idle' });
    setInputValue('0');
    setRemarks('');
    setSelectedMember(null);
    setDiscountMode(false);
    setDiscountInput('0');
    setDebtMode(false);
    setPayStash(stash);
    setPayIsDebt(isDebt);
    setCashInput('');

    if (isDebt) {
      // Kredit: show "Uang diterima?" prompt before committing
      setPayPhase('payment');
    } else {
      // Normal: commit is deferred — show success + 3s undo window
      setPayPhase('success');
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        commitStash(stash, undefined);
        setPayPhase('idle');
        setPayStash(null);
        undoTimerRef.current = null;
      }, 3000);
    }
  }, [items, remarks, selectedMember, discountInput, debtMode, commitStash, computeShortages]);

  // Confirm kredit payment (optionally with a partial cash amount)
  const handlePayConfirm = useCallback(() => {
    if (!payStash) return;
    const total = Math.max(0, payStash.items.reduce((s, i) => s + i.total, 0) - payStash.discount);
    const cash = Number(cashInput);
    // 0 or empty = fully unpaid kredit; otherwise record as partial payment
    const amountPaid: number | undefined = cash > 0 && cash < total ? cash : (cash === 0 ? 0 : undefined);
    commitStash(payStash, amountPaid);
    setPayPhase('success');
    setPayStash(null);
    setCashInput('');
    setTimeout(() => { setPayPhase('idle'); setPayIsDebt(false); }, 1200);
  }, [payStash, cashInput, commitStash]);

  const handlePayUndo = useCallback(() => {
    // Cancel pending deferred commit (normal path)
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    if (payStash) {
      setItems(payStash.items);
      setRemarks(payStash.remarks);
      setSelectedMember(payStash.memberId ? (members.find(m => m.id === payStash.memberId) ?? null) : null);
      if (payStash.discount > 0) setDiscountInput(String(payStash.discount));
      setDebtMode(payIsDebt);
    }
    setPayPhase('idle');
    setPayStash(null);
    setPayIsDebt(false);
    setCashInput('');
  }, [payStash, payIsDebt, members]);

  const removeItem = useCallback((id: string) => setItems(items.filter(x => x.id !== id)), [items]);
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const transactionTotal = Math.max(0, subtotal - appliedDiscount);

  const handleDiscountToggle = useCallback(() => {
    setDiscountMode(m => !m);
  }, []);

  const neuBtn = (color: string, active: boolean): React.CSSProperties => ({
    background: active ? color : '#eef0f5',
    boxShadow: active
      ? `3px 3px 8px rgba(0,0,0,0.16), -2px -2px 6px rgba(255,255,255,0.7)`
      : '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff',
    borderRadius: '11px',
    border: 'none',
    cursor: 'pointer',
    padding: compact ? '12px 8px' : '15px 10px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    transition: 'box-shadow 0.15s, background 0.15s',
    minWidth: compact ? 40 : 48,
    flex: 1,
  });

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: `${compact ? 10 : 14}px var(--app-page-gutter) var(--app-content-bottom)`, gap: compact ? 8 : 12 }}>
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
          isLoading={rawMembers === undefined}
        />
      )}

      {/* Keranjang */}
      <div style={{ flex: '1 1 auto', minHeight: 80 }}>
        <div
          role="region"
          aria-label="Keranjang"
          style={{
            background: '#eef0f5',
            boxShadow: 'inset 3px 3px 8px #c8cad1, inset -3px -3px 8px #ffffff',
            borderRadius: '14px',
            padding: compact ? '8px 10px' : '11px 13px',
            display: 'flex', flexDirection: 'column',
            height: '100%', boxSizing: 'border-box',
            overflow: 'hidden',
          }}>

          {/* Locked header */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>
                KERANJANG{items.length > 0 ? ` (${items.length})` : ''}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  aria-label="Tambah catatan"
                  onClick={() => setShowRemarksModal(true)}
                  onPointerDown={() => { softTap(); setPressedIcon('remarks'); }}
                  onPointerUp={() => setPressedIcon(null)}
                  onPointerLeave={() => setPressedIcon(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                >
                  <MessageSquare size={15} color={remarks ? '#4a90d9' : '#c0c4d0'} style={{ transform: pressedIcon === 'remarks' ? 'scale(0.75)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                  <span style={{ fontSize: '8px', color: remarks ? '#4a90d9' : '#c0c4d0', lineHeight: 1, userSelect: 'none' }}>Catatan</span>
                </button>
                <button
                  aria-label="Pilih pembeli"
                  onClick={() => setShowMemberPicker(true)}
                  onPointerDown={() => { softTap(); setPressedIcon('member'); }}
                  onPointerUp={() => setPressedIcon(null)}
                  onPointerLeave={() => setPressedIcon(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                >
                  <User size={15} color={selectedMember ? '#4a90d9' : '#c0c4d0'} style={{ transform: pressedIcon === 'member' ? 'scale(0.75)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                  <span style={{ fontSize: '8px', color: selectedMember ? '#4a90d9' : '#c0c4d0', lineHeight: 1, userSelect: 'none' }}>Pembeli</span>
                </button>
                {/* Kredit slider toggle — only active when a member is selected */}
                <div
                  role="switch"
                  aria-checked={debtMode}
                  aria-disabled={!selectedMember}
                  aria-label="Kredit"
                  onClick={() => { if (selectedMember) setDebtMode(m => !m); }}
                  style={{ cursor: selectedMember ? 'pointer' : 'default', padding: '4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, userSelect: 'none', opacity: selectedMember ? 1 : 0.35, transition: 'opacity 0.15s' }}
                >
                  <div style={{ width: 30, height: 17, borderRadius: 9, background: '#eef0f5', boxShadow: 'inset 2px 2px 4px #c8cad1, inset -2px -2px 4px #ffffff', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: debtMode ? 13 : 2, width: 13, height: 13, borderRadius: '50%', background: debtMode ? '#d4a017' : '#c0c4d0', boxShadow: debtMode ? '0 1px 4px rgba(212,160,23,0.5)' : '1px 1px 2px rgba(0,0,0,0.18)', transition: 'left 0.18s, background 0.18s' }} />
                  </div>
                  <span style={{ fontSize: '8px', color: debtMode ? '#d4a017' : '#c0c4d0', lineHeight: 1, fontWeight: 600 }}>Kredit</span>
                </div>
              </div>
            </div>
            {selectedMember && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                <User size={9} color="#4a90d9" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: '#4a90d9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{selectedMember.name}</span>
              </div>
            )}
          </div>

          {/* Insufficient-stock warning — blocks completion until resolved */}
          {stockError && payPhase === 'idle' && (
            <div
              role="alert"
              style={{
                flexShrink: 0, marginBottom: 6,
                background: '#eef0f5',
                boxShadow: 'inset 2px 2px 6px #d9b8bf, inset -2px -2px 6px #ffffff',
                borderRadius: 12, padding: '9px 11px',
                display: 'flex', gap: 8, alignItems: 'flex-start',
                animation: 'flash-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              <AlertTriangle size={15} color="#d4183d" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#d4183d', marginBottom: 3 }}>
                  Stok tidak cukup — tambah stok dulu
                </div>
                <div style={{ fontSize: '10px', color: '#8a6a70', lineHeight: 1.45 }}>
                  {stockError.map(s => (
                    <div key={s.name}>
                      <span style={{ fontWeight: 600, color: '#6a4e53' }}>{s.name}</span>: sisa {fmtQty(s.have)}, butuh {fmtQty(s.need)} {s.unit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Scrollable items area */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {payPhase === 'payment' ? (
              /* Kredit only — ask for partial cash amount before committing */
              (() => {
                const kTotal = Math.max(0, (payStash?.items.reduce((s,i)=>s+i.total,0)??0) - (payStash?.discount??0));
                const kCash  = Number(cashInput) || 0;
                return (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, animation: 'flash-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#d4a017', fontWeight: 600 }}>KREDIT</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(kTotal)}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9a9db5', fontWeight: 600, pointerEvents: 'none' }}>Rp</span>
                      <input
                        type="text" inputMode="numeric"
                        placeholder="Uang diterima (kosong = belum lunas)"
                        value={cashInput ? kCash.toLocaleString('id-ID') : ''}
                        onChange={e => setCashInput(e.target.value.replace(/\D/g, ''))}
                        style={{ width: '100%', boxSizing: 'border-box', background: '#eef0f5', boxShadow: 'inset 2px 2px 5px #c8cad1, inset -2px -2px 5px #ffffff', borderRadius: 10, border: 'none', outline: 'none', padding: '8px 10px 8px 30px', fontSize: '13px', color: '#2d3142', fontFamily: 'inherit' }}
                      />
                    </div>
                    {kCash > kTotal && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#52b96a', fontWeight: 600 }}>KEMBALIAN</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#52b96a' }}>{formatRupiah(kCash - kTotal)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handlePayUndo} aria-label="Batalkan" style={{ flex: 1, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', background: '#d4183d', boxShadow: '3px 3px 8px rgba(0,0,0,0.14), -2px -2px 6px rgba(255,255,255,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RotateCcw size={14} strokeWidth={2.5} />
                      </button>
                      <button onClick={handlePayConfirm} style={{ flex: 2, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', background: '#52b96a', boxShadow: '3px 3px 8px rgba(0,0,0,0.14), -2px -2px 6px rgba(255,255,255,0.5)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Check size={12} /> Konfirmasi
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : payPhase === 'success' ? (
              payStash !== null ? (
                /* Normal transaction — undo window (commit fires after 5s) */
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, animation: 'flash-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#52b96a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={11} color="#fff" strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#52b96a' }}>Berhasil!</span>
                    </div>
                    <button onClick={handlePayUndo} aria-label="Batalkan" style={{ height: 30, width: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#d4183d', boxShadow: '3px 3px 8px rgba(0,0,0,0.14), -2px -2px 6px rgba(255,255,255,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <RotateCcw size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div style={{ height: 3, background: '#e0e3ec', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#52b96a', borderRadius: 2, animation: 'undo-shrink 3s linear forwards' }} />
                  </div>
                </div>
              ) : (
                /* Kredit confirmed — brief flash */
                <div role="alert" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, animation: 'flash-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#52b96a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={13} color="#fff" strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#52b96a' }}>Berhasil!</span>
                </div>
              )
            ) : items.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', color: '#c0c4d0' }}>Pilih produk & masukkan jumlah</span>
              </div>
            ) : (
              <>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map(item => (
                    <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, animation: 'cart-item-in 160ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#2d3142', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {item.productShortName}{item.plasticSize ? ` ${item.plasticSize}` : ''}
                      </span>
                      <span style={{ fontSize: '10px', color: '#9a9db5' }}>
                        {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)} {item.unit}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a4e69', minWidth: 72, textAlign: 'right' }}>
                        {formatRupiah(item.total)}
                      </span>
                      <button
                        aria-label={`Hapus ${item.productShortName}`}
                        onClick={() => removeItem(item.id)}
                        onPointerDown={() => { tap(); setPressedRemove(item.id); }}
                        onPointerUp={() => setPressedRemove(null)}
                        onPointerLeave={() => setPressedRemove(null)}
                        style={{ background: 'transparent', border: 'none', color: '#d4183d', cursor: 'pointer', padding: '16px 8px' }}
                      >
                        <X size={11} style={{ transform: pressedRemove === item.id ? 'scale(0.72)' : 'scale(1)', transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                      </button>
                    </li>
                  ))}
                </ul>
                {remarks && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 4, marginBottom: 4, paddingTop: 5, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <MessageSquare size={10} color="#9a9db5" style={{ marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: '#9a9db5', fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, flex: 1, minWidth: 0 }}>{remarks}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Locked footer — totals (only during normal cart view) */}
          {items.length > 0 && payPhase === 'idle' && (
            <div style={{ flexShrink: 0, paddingTop: 7, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              {appliedDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: '9px', color: '#d4183d', letterSpacing: '0.08em', fontWeight: 600 }}>DISKON</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#d4183d' }}>−{formatRupiah(appliedDiscount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>TOTAL</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#2d3142' }}>{formatRupiah(transactionTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ZONE */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Calculator display */}
        <div style={{
          background: '#1a1d2e', borderRadius: '16px',
          padding: compact ? '8px 12px 10px' : '10px 16px 12px',
          boxShadow: 'inset 5px 5px 12px #0d0f1a, inset -3px -3px 8px #2a2f48',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '16px', background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3, position: 'relative', gap: 8 }}>
            <div>
              {discountMode ? (
                <>
                  <div style={{ fontSize: '9px', color: '#ff6f8a', letterSpacing: '0.1em', marginBottom: 1 }}>DISKON</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ff6f8a' }}>Rp</div>
                </>
              ) : selectedProduct ? (
                <>
                  <div style={{ fontSize: '9px', color: '#3a4060', letterSpacing: '0.1em', marginBottom: 1 }}>UNIT</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: selectedProduct.isEceran ? '#9b6dff' : selectedProduct.color }}>
                    {selectedProduct.unit}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '10px', color: '#3a4060' }}>
                  {step.type === 'plastic_size' || step.type === 'eceran_brand' ? '← pilih merek' : 'Unit: —'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedProduct && !discountMode && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: '#3a4060', letterSpacing: '0.1em', marginBottom: 1 }}>TOTAL</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: computedTotal > 0 ? '#7ee8a2' : '#3a4060' }}>
                    {computedTotal > 0 ? formatRupiah(computedTotal) : '—'}
                  </div>
                </div>
              )}
              <button
                onClick={handleDiscountToggle}
                aria-label={discountMode ? 'Tutup diskon' : 'Diskon'}
                style={{
                  position: 'relative', zIndex: 2,
                  width: 28, height: 28, borderRadius: '50%',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: discountMode ? '#ff6f8a' : '#252947',
                  color: discountMode ? '#fff' : (appliedDiscount > 0 ? '#ff6f8a' : '#5a6088'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: discountMode
                    ? '0 0 0 2px rgba(255, 111, 138, 0.22), 0 2px 8px rgba(255, 111, 138, 0.45)'
                    : 'inset 2px 2px 4px #0d0f1a, inset -1px -1px 3px #2a2f48',
                  transition: 'background 0.18s, box-shadow 0.18s, color 0.18s',
                  fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', lineHeight: 1,
                }}
              >
                %
              </button>
            </div>
          </div>
          {/* Number display */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '34px', fontWeight: 700, color: discountMode ? '#ffd1da' : '#dde2f0',
            textAlign: 'right', letterSpacing: '0.06em', lineHeight: 1,
            display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1,
          }}>
            <span>
              {discountMode
                ? (discountInput === '0' ? '' : discountInput)
                : (inputValue === '0' ? '' : inputValue)}
            </span>
            <span style={{
              display: 'inline-block',
              color: discountMode ? '#ff6f8a' : (selectedProduct ? '#7ee8a2' : '#2a3050'),
              animation: discountMode ? 'cursor-blink 1s step-end infinite' : (step.type === 'idle' ? 'none' : 'cursor-blink 1s step-end infinite'),
              fontSize: '30px', lineHeight: 1, marginBottom: '2px',
            }}>|</span>
          </div>
        </div>

        {/* Product Selection */}
        <div style={{ background: '#eef0f5', boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff', borderRadius: '16px', padding: '12px' }}>
          {rawProducts === undefined ? (
            /* Skeleton while products load */
            <>
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontSize: '8px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 7 }}>KEDELAI</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      flex: 1, minWidth: compact ? 40 : 48,
                      height: compact ? 44 : 50,
                      borderRadius: 11, background: '#e0e3ec',
                      animation: `skel-pulse 1.4s ease-in-out ${i * 70}ms infinite`,
                    }} />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '8px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 7 }}>LAINNYA</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      flex: 1, minWidth: compact ? 40 : 48,
                      height: compact ? 44 : 50,
                      borderRadius: 11, background: '#e0e3ec',
                      animation: `skel-pulse 1.4s ease-in-out ${(i + 5) * 70}ms infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontSize: '8px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 7 }}>KEDELAI</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {/* Eceran modifier button */}
                  {(() => {
                    const eActive = step.type === 'eceran_brand' || !!(step.type === 'quantity' && step.isEceran);
                    return (
                      <button onClick={handleEceranClick} style={neuBtn('#9b6dff', eActive)}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: eActive ? '#fff' : '#9b6dff' }}>E</span>
                      </button>
                    );
                  })()}
                  {soybeanProducts.map(p => {
                    const isActive = step.type === 'quantity' && step.productId === p.id;
                    const withEceran = isActive && !!(step.type === 'quantity' && step.isEceran);
                    const btnColor = withEceran ? '#9b6dff' : p.color;
                    return (
                      <button key={p.id} onClick={() => handleSoybeanClick(p.id)} style={neuBtn(btnColor, isActive)}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#fff' : p.color }}>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '8px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 7 }}>LAINNYA</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <button
                    onClick={handlePlasticClick}
                    style={neuBtn(PLASTIC_COLOR, step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic'))}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: (step.type === 'plastic_size' || (step.type === 'quantity' && step.productId === 'plastic')) ? '#fff' : PLASTIC_COLOR }}>P</span>
                  </button>
                  {otherProducts.map(p => {
                    const isActive = step.type === 'quantity' && step.productId === p.id;
                    return (
                      <button key={p.id} onClick={() => handleOtherClick(p.id)} style={neuBtn(p.color, isActive)}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#fff' : p.color }}>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Plastic size grid */}
        {step.type === 'plastic_size' && (
          <div style={{ background: '#eef0f5', boxShadow: '5px 5px 12px #c8cad1, -5px -5px 12px #ffffff', borderRadius: '14px', padding: '10px', animation: 'panel-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <div style={{ fontSize: '8px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 7 }}>UKURAN PLASTIK</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[...plasticSizes].sort((a, b) => {
                const p = (s: string) => s.split(/[×x]/).map(Number);
                const [a1, a2] = p(a.size), [b1, b2] = p(b.size);
                return a1 !== b1 ? a1 - b1 : a2 - b2;
              }).map(ps => (
                <button key={ps.id} onClick={() => handlePlasticSizeClick(ps.id)} style={{ borderRadius: '9px', padding: '16px 8px', minHeight: 44, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: PLASTIC_COLOR }}>{ps.size}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Numpad */}
        <Numpad
          value={discountMode ? discountInput : inputValue}
          onChange={discountMode ? setDiscountInput : handleInputChange}
          onAddItem={handleAddItem}
          onComplete={handleComplete}
          canAdd={!discountMode && step.type === 'quantity' && parseFloat(inputValue) > 0}
          canComplete={items.length > 0 && payPhase === 'idle'}
          allowDecimal={discountMode ? false : (step.type !== 'quantity' || step.unit !== 'pcs')}
          maxValue={discountMode ? undefined : (step.type === 'quantity' && step.isEceran ? 10 : undefined)}
          digitsDisabled={!discountMode && step.type !== 'quantity'}
        />
      </div>

      <style>{`
        @keyframes skel-pulse {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1; }
        }
        @keyframes undo-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
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
