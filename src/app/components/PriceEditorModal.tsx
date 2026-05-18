import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface Props {
  onClose: () => void;
}

const SHD_RAISED_STD    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RECESSED      = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';

const PRESET_COLORS = [
  '#f5903d', '#4a90d9', '#52b96a', '#e05a6a',
  '#9b6dff', '#38b2ac', '#d4a017', '#e84393',
  '#00bcd4', '#8bc34a', '#ff6b35', '#673ab7',
];

const neuInput: React.CSSProperties = {
  background: '#eef0f5',
  boxShadow: SHD_RECESSED,
  borderRadius: '10px',
  border: 'none',
  outline: 'none',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#2d3142',
  width: '100%',
};

export function PriceEditorModal({ onClose }: Props) {
  const rawProducts = useQuery(api.products.listWithPrices);

  const setPrice          = useMutation(api.products.updatePrice);
  const setColor          = useMutation(api.products.updateColor);
  const createSoybean     = useMutation(api.products.addSoybean);
  const deactivateProduct = useMutation(api.products.deactivate);
  const setAllVariant     = useMutation(api.products.updateAllVariantPrices);
  const createVariant     = useMutation(api.products.addVariant);
  const deleteVariant     = useMutation(api.products.removeVariant);

  const soybeanProducts = useMemo(() =>
    (rawProducts ?? []).filter(p => p.unit === 'kg' && p.name !== 'E'),
    [rawProducts]
  );
  const eceranProduct = useMemo(() =>
    (rawProducts ?? []).find(p => p.name === 'E'),
    [rawProducts]
  );
  const plasticProduct = useMemo(() =>
    (rawProducts ?? []).find(p => p.unit === 'pcs' && p.variants.length > 0),
    [rawProducts]
  );
  const plasticDisplayPrice = plasticProduct?.variants[0]?.price ?? plasticProduct?.price ?? 0;
  const otherProducts = useMemo(() =>
    (rawProducts ?? []).filter(p => p.unit === 'pcs' && p.variants.length === 0),
    [rawProducts]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const [savedKey, setSavedKey] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = (key: string) => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedKey(null);
    requestAnimationFrame(() => {
      setSavedKey(key);
      savedTimer.current = setTimeout(() => setSavedKey(null), 1800);
    });
  };

  const [newSoyName, setNewSoyName]   = useState('');
  const [newSoyFull, setNewSoyFull]   = useState('');
  const [newSoyPrice, setNewSoyPrice] = useState('');
  const [newSoyColor, setNewSoyColor] = useState(PRESET_COLORS[0]);
  const [newPlasticSize, setNewPlasticSize] = useState('');
  const [activeTab, setActiveTab]     = useState<'soybean' | 'other'>('soybean');
  const [showAddSoy, setShowAddSoy]   = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  const switchTab = (tab: 'soybean' | 'other') => {
    setActiveTab(tab);
    setShowAddSoy(false);
    setShowAddSize(false);
    setColorPickerFor(null);
  };

  const closeSoyForm = () => {
    setShowAddSoy(false);
    setNewSoyName(''); setNewSoyFull(''); setNewSoyPrice(''); setNewSoyColor(PRESET_COLORS[0]);
  };

  const closeSizeForm = () => {
    setShowAddSize(false);
    setNewPlasticSize('');
  };

  return (
    <>
      <style>{`
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes form-expand {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-confirm {
          0%   { opacity: 0; transform: translateY(2px); }
          20%  { opacity: 1; transform: translateY(0); }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <div
        className="fixed z-50 flex items-end justify-center"
        style={{ left: 0, right: 0, top: 'var(--app-visual-offset-top)', height: 'var(--app-visual-height)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#eef0f5',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
            borderRadius: '24px 24px 0 0',
            width: '100%', maxWidth: 430,
            maxHeight: 'min(85vh, calc(var(--app-visual-height) - 16px))', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            animation: 'sheet-slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <div>
              <div style={{ fontSize: '11px', color: '#9a9db5', letterSpacing: '0.08em' }}>EDITOR</div>
              <h2 style={{ color: '#2d3142', margin: 0, fontSize: '20px', fontWeight: 700, lineHeight: 1.3 }}>Daftar Harga</h2>
            </div>
            <button
              onClick={onClose}
              style={{ background: '#eef0f5', boxShadow: SHD_RAISED_STD, width: 36, height: 36, borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: 'box-shadow 0.12s' }}
            >
              <X size={16} color="#9a9db5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-5 mb-4 shrink-0">
            {(['soybean', 'other'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: '10px',
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em',
                  background: '#eef0f5',
                  color: activeTab === tab ? '#4a90d9' : '#9a9db5',
                  boxShadow: activeTab === tab ? SHD_RECESSED : SHD_RAISED_STD,
                  transition: 'all 0.15s', border: 'none', cursor: 'pointer',
                }}
              >
                {tab === 'soybean' ? 'Kedelai' : 'Lainnya'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-5 pb-6" style={{ scrollbarWidth: 'none' }}>

            {/* ── KEDELAI TAB ── */}
            {activeTab === 'soybean' && (
              <div className="flex flex-col gap-3">
                {soybeanProducts.map(p => (
                  <div key={p._id}>
                    <div className="flex items-center gap-3">
                      {/* Color dot — tap to open picker */}
                      <button
                        onClick={() => setColorPickerFor(colorPickerFor === p._id ? null : p._id)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: p.color, flexShrink: 0,
                          border: colorPickerFor === p._id ? '2.5px solid #2d3142' : '2.5px solid transparent',
                          boxShadow: colorPickerFor === p._id ? `0 0 0 1.5px #eef0f5, ${SHD_RAISED_STD}` : 'none',
                          cursor: 'pointer', padding: 0,
                          transition: 'box-shadow 0.12s, border-color 0.12s',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#9a9db5' }}>{p.fullName}</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>{p.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                        <input
                          type="number"
                          defaultValue={p.price}
                          key={`${p._id}-${p.price}`}
                          style={{ ...neuInput, width: 100, textAlign: 'right' }}
                          onBlur={e => setPrice({ productId: p._id as Id<'products'>, price: parseFloat(e.target.value) || p.price }).then(() => confirm(`price-${p._id}`)).catch(console.error)}
                        />
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>/kg</span>
                        {savedKey === `price-${p._id}` && (
                          <span style={{ fontSize: '12px', color: '#52b96a', fontWeight: 700, animation: 'fade-confirm 1.8s ease both' }}>✓</span>
                        )}
                      </div>
                      <button
                        onClick={() => deactivateProduct({ productId: p._id as Id<'products'> }).catch(console.error)}
                        style={{ color: '#d4183d', background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Inline color picker */}
                    {colorPickerFor === p._id && (
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8,
                        padding: '10px 12px', marginTop: 6,
                        background: '#eef0f5', boxShadow: SHD_RECESSED,
                        borderRadius: '10px',
                        animation: 'form-expand 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
                      }}>
                        {PRESET_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              setColor({ productId: p._id as Id<'products'>, color }).catch(console.error);
                              setColorPickerFor(null);
                            }}
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: color, border: 'none', cursor: 'pointer', padding: 0,
                              outline: p.color === color ? `2.5px solid #2d3142` : 'none',
                              outlineOffset: 2,
                              transform: p.color === color ? 'scale(1.15)' : 'scale(1)',
                              transition: 'transform 0.1s',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Eceran price */}
                <div style={{ height: 1, background: '#dde0ea', margin: '2px 0' }} />
                <div className="flex items-center gap-3">
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#9b6dff', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#9a9db5' }}>Harga Eceran</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>E — Semua Merek</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                    <input
                      type="number"
                      defaultValue={eceranProduct?.price ?? 0}
                      key={eceranProduct?.price}
                      style={{ ...neuInput, width: 100, textAlign: 'right' }}
                      onBlur={e => {
                        if (!eceranProduct) return;
                        setPrice({ productId: eceranProduct._id as Id<'products'>, price: parseFloat(e.target.value) || eceranProduct.price }).then(() => confirm('eceran')).catch(console.error);
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>/kg</span>
                    {savedKey === 'eceran' && (
                      <span style={{ fontSize: '12px', color: '#52b96a', fontWeight: 700, animation: 'fade-confirm 1.8s ease both' }}>✓</span>
                    )}
                  </div>
                </div>
                <div style={{ height: 1, background: '#dde0ea', margin: '2px 0' }} />

                {/* Add new soybean */}
                {showAddSoy ? (
                  <div style={{
                    background: '#eef0f5', boxShadow: SHD_RECESSED,
                    borderRadius: '12px', padding: '12px',
                    animation: 'form-expand 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.06em' }}>PRODUK BARU</div>
                      <button onClick={closeSoyForm} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#9a9db5' }}>
                        <X size={12} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input placeholder="Kode (MRB)" style={{ ...neuInput, flex: 1 }} value={newSoyName} onChange={e => setNewSoyName(e.target.value.toUpperCase())} autoFocus />
                        <input placeholder="Nama Lengkap" style={{ ...neuInput, flex: 2 }} value={newSoyFull} onChange={e => setNewSoyFull(e.target.value)} />
                      </div>
                      {/* Color picker row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '6px 2px' }}>
                        {PRESET_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewSoyColor(color)}
                            style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: color, border: 'none', cursor: 'pointer', padding: 0,
                              outline: newSoyColor === color ? `2.5px solid #2d3142` : 'none',
                              outlineOffset: 2,
                              transform: newSoyColor === color ? 'scale(1.2)' : 'scale(1)',
                              transition: 'transform 0.1s',
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="number" placeholder="Harga/kg" style={{ ...neuInput, flex: 2 }} value={newSoyPrice} onChange={e => setNewSoyPrice(e.target.value)} />
                        <button
                          onClick={() => {
                            if (newSoyName && newSoyFull && newSoyPrice) {
                              createSoybean({ name: newSoyName, fullName: newSoyFull, color: newSoyColor, price: parseFloat(newSoyPrice) }).catch(console.error);
                              closeSoyForm();
                            }
                          }}
                          style={{
                            flex: 1, borderRadius: '10px', background: '#4a90d9',
                            color: '#fff', border: 'none', fontWeight: 700, fontSize: '13px',
                            boxShadow: SHD_ACTION_RAISED,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            cursor: 'pointer', padding: '8px 0', transition: 'box-shadow 0.12s',
                          }}
                        >
                          <Plus size={14} /> Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddSoy(true)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '9px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: '#eef0f5', boxShadow: SHD_RAISED_STD,
                      fontSize: '11px', fontWeight: 600, color: '#4a90d9',
                      transition: 'box-shadow 0.12s',
                    }}
                  >
                    <Plus size={12} /> Tambah Produk
                  </button>
                )}
              </div>
            )}

            {/* ── LAINNYA TAB ── */}
            {activeTab === 'other' && (
              <div className="flex flex-col gap-3">

                {/* Plastic */}
                <div>
                  <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>PLASTIK</div>
                  {plasticProduct ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#38b2ac', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: '#9a9db5' }}>Semua ukuran</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>P — Plastik</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                          <input
                            type="number"
                            defaultValue={plasticDisplayPrice}
                            key={plasticDisplayPrice}
                            style={{ ...neuInput, width: 100, textAlign: 'right' }}
                            onBlur={e => setAllVariant({ productId: plasticProduct._id as Id<'products'>, price: parseFloat(e.target.value) || plasticDisplayPrice }).then(() => confirm('plastic')).catch(console.error)}
                          />
                          <span style={{ fontSize: '11px', color: '#9a9db5' }}>/pcs</span>
                          {savedKey === 'plastic' && (
                            <span style={{ fontSize: '12px', color: '#52b96a', fontWeight: 700, animation: 'fade-confirm 1.8s ease both' }}>✓</span>
                          )}
                        </div>
                      </div>

                      {/* Plastic size management */}
                      <div style={{ background: '#eef0f5', boxShadow: SHD_RECESSED, borderRadius: '10px', padding: '10px', marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: '10px', color: '#9a9db5', fontWeight: 600 }}>UKURAN</div>
                          <button
                            onClick={() => showAddSize ? closeSizeForm() : setShowAddSize(true)}
                            style={{
                              background: '#eef0f5',
                              boxShadow: showAddSize ? SHD_RECESSED : SHD_RAISED_STD,
                              border: 'none', borderRadius: '7px', cursor: 'pointer',
                              width: 22, height: 22,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'box-shadow 0.12s',
                            }}
                          >
                            {showAddSize ? <X size={10} color="#9a9db5" /> : <Plus size={10} color="#9a9db5" />}
                          </button>
                        </div>

                        {showAddSize && (
                          <div style={{ animation: 'form-expand 200ms cubic-bezier(0.16, 1, 0.3, 1) both', marginTop: 8 }}>
                            {plasticProduct.variants.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {plasticProduct.variants.map(ps => (
                                  <div key={ps._id} style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    background: '#eef0f5', boxShadow: SHD_RAISED_STD,
                                    borderRadius: '8px', padding: '4px 8px',
                                  }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#38b2ac' }}>{ps.variantValue}</span>
                                    <button onClick={() => deleteVariant({ variantId: ps._id as Id<'productVariants'> }).catch(console.error)} style={{ background: 'transparent', border: 'none', color: '#d4183d', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                placeholder="Ukuran baru (10×20)"
                                style={{ ...neuInput, flex: 1 }}
                                value={newPlasticSize}
                                onChange={e => setNewPlasticSize(e.target.value)}
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  if (newPlasticSize && plasticProduct) {
                                    createVariant({ productId: plasticProduct._id as Id<'products'>, variantValue: newPlasticSize, price: plasticDisplayPrice }).catch(console.error);
                                    closeSizeForm();
                                  }
                                }}
                                style={{
                                  borderRadius: '10px', background: '#38b2ac', color: '#fff', border: 'none',
                                  fontWeight: 700, padding: '0 14px',
                                  boxShadow: SHD_ACTION_RAISED,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                  transition: 'box-shadow 0.12s',
                                }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#c0c4d0', textAlign: 'center', padding: '12px 0' }}>
                      Belum ada produk plastik
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: '#dde0ea', margin: '4px 0' }} />

                {/* Other products */}
                <div>
                  <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>PRODUK LAIN</div>
                  {otherProducts.map(p => (
                    <div key={p._id} className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#9a9db5' }}>{p.fullName}</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>{p.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                        <input
                          type="number"
                          defaultValue={p.price}
                          key={`${p._id}-${p.price}`}
                          style={{ ...neuInput, width: 100, textAlign: 'right' }}
                          onBlur={e => setPrice({ productId: p._id as Id<'products'>, price: parseFloat(e.target.value) || p.price }).then(() => confirm(`price-${p._id}`)).catch(console.error)}
                        />
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>/pcs</span>
                        {savedKey === `price-${p._id}` && (
                          <span style={{ fontSize: '12px', color: '#52b96a', fontWeight: 700, animation: 'fade-confirm 1.8s ease both' }}>✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {otherProducts.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#c0c4d0', textAlign: 'center', padding: '12px 0' }}>
                      Belum ada produk lain
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
