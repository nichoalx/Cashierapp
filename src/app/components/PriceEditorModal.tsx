import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';

interface Props {
  onClose: () => void;
}

const SHD_RAISED_STD    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_RECESSED      = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';
const SHD_ACTION_RAISED = '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)';

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
  const {
    soybeanProducts, plasticBasePrice, otherProducts, eceranPrice,
    updateSoybeanPrice, updateOtherPrice, updatePlasticBasePrice, updateEceranPrice,
    addSoybeanProduct, removeSoybeanProduct,
    addPlasticSize, removePlasticSize, plasticSizes,
  } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  const [newSoyName, setNewSoyName]       = useState('');
  const [newSoyFull, setNewSoyFull]       = useState('');
  const [newSoyPrice, setNewSoyPrice]     = useState('');
  const [newPlasticSize, setNewPlasticSize] = useState('');
  const [activeTab, setActiveTab]         = useState<'soybean' | 'other'>('soybean');
  const [showAddSoy, setShowAddSoy]       = useState(false);
  const [showAddSize, setShowAddSize]     = useState(false);

  const switchTab = (tab: 'soybean' | 'other') => {
    setActiveTab(tab);
    setShowAddSoy(false);
    setShowAddSize(false);
  };

  const closeSoyForm = () => {
    setShowAddSoy(false);
    setNewSoyName(''); setNewSoyFull(''); setNewSoyPrice('');
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
                  <div key={p.id} className="flex items-center gap-3">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#9a9db5' }}>{p.fullName}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>{p.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                      <input
                        type="number"
                        defaultValue={p.price}
                        style={{ ...neuInput, width: 100, textAlign: 'right' }}
                        onBlur={e => updateSoybeanPrice(p.id, parseFloat(e.target.value) || p.price)}
                      />
                      <span style={{ fontSize: '11px', color: '#9a9db5' }}>/kg</span>
                    </div>
                    <button
                      onClick={() => removeSoybeanProduct(p.id)}
                      style={{ color: '#d4183d', background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Eceran price — fixed modifier, not a product */}
                <div style={{ height: 1, background: '#dde0ea', margin: '2px 0' }} />
                <div className="flex items-center gap-3">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#9b6dff', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#9a9db5' }}>Harga Eceran</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>E — Semua Merek</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                    <input
                      type="number"
                      defaultValue={eceranPrice}
                      key={eceranPrice}
                      style={{ ...neuInput, width: 100, textAlign: 'right' }}
                      onBlur={e => updateEceranPrice(parseFloat(e.target.value) || eceranPrice)}
                    />
                    <span style={{ fontSize: '11px', color: '#9a9db5' }}>/kg</span>
                  </div>
                </div>
                <div style={{ height: 1, background: '#dde0ea', margin: '2px 0' }} />

                {/* Add new soybean — collapsed by default */}
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
                      <div className="flex gap-2">
                        <input type="number" placeholder="Harga/kg" style={{ ...neuInput, flex: 2 }} value={newSoyPrice} onChange={e => setNewSoyPrice(e.target.value)} />
                        <button
                          onClick={() => {
                            if (newSoyName && newSoyFull && newSoyPrice) {
                              addSoybeanProduct(newSoyName, newSoyFull, parseFloat(newSoyPrice));
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

                {/* Plastic — single row */}
                <div>
                  <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>PLASTIK</div>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38b2ac', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#9a9db5' }}>Semua ukuran</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>P — Plastik</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                      <input
                        type="number"
                        defaultValue={plasticBasePrice}
                        key={plasticBasePrice}
                        style={{ ...neuInput, width: 100, textAlign: 'right' }}
                        onBlur={e => updatePlasticBasePrice(parseFloat(e.target.value) || plasticBasePrice)}
                      />
                      <span style={{ fontSize: '11px', color: '#9a9db5' }}>/pcs</span>
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
                        {plasticSizes.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {plasticSizes.map(ps => (
                              <div key={ps.id} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: '#eef0f5', boxShadow: SHD_RAISED_STD,
                                borderRadius: '8px', padding: '4px 8px',
                              }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#38b2ac' }}>{ps.size}</span>
                                <button onClick={() => removePlasticSize(ps.id)} style={{ background: 'transparent', border: 'none', color: '#d4183d', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
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
                              if (newPlasticSize) { addPlasticSize(newPlasticSize); closeSizeForm(); }
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
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: '#dde0ea', margin: '4px 0' }} />

                {/* Other products */}
                <div>
                  <div style={{ fontSize: '10px', color: '#9a9db5', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>PRODUK LAIN</div>
                  {otherProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#9a9db5' }}>{p.fullName}</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3142' }}>{p.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>Rp</span>
                        <input
                          type="number"
                          defaultValue={p.price}
                          style={{ ...neuInput, width: 100, textAlign: 'right' }}
                          onBlur={e => updateOtherPrice(p.id, parseFloat(e.target.value) || p.price)}
                        />
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>/pcs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
