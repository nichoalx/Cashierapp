import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { formatRupiah } from '../store';
import { ArrowLeft, Phone, ChevronRight, Search, X } from 'lucide-react';

const SHD_RAISED    = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_LIST      = '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92)';
const SHD_RECESSED  = 'inset 3px 3px 7px #c8cad1, inset -3px -3px 7px #ffffff';

const AVATAR_COLORS = [
  '#f5903d', '#4a90d9', '#52b96a', '#9b6dff',
  '#e05a6a', '#38b2ac', '#d4a017', '#e84393',
  '#6366f1', '#0ea5e9', '#14b8a6', '#64748b',
];

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${parseInt(d, 10)} ${MONTHS_ID[parseInt(m, 10) - 1]} ${y}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  });
}

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
}

function MemberDetailSkeleton({ onBack }: { onBack: () => void }) {
  const S: React.CSSProperties = { background: '#e0e3ec', animation: 'skel-pulse 1.4s ease-in-out infinite', borderRadius: 5, flexShrink: 0 };
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '16px var(--app-page-gutter) 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ArrowLeft size={16} color="#4a4e69" />
        </button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ ...S, height: 9, width: '22%' }} />
          <div style={{ ...S, height: 18, width: '48%', animationDelay: '0.07s' }} />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 var(--app-page-gutter) var(--app-content-bottom)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Member card */}
        <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ ...S, width: 52, height: 52, borderRadius: 14 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ ...S, height: 15, width: '55%', animationDelay: '0.08s' }} />
            <div style={{ ...S, height: 11, width: '35%', animationDelay: '0.16s' }} />
          </div>
        </div>
        {/* Orders */}
        <div>
          <div style={{ ...S, height: 9, width: '35%', marginBottom: 8 }} />
          <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: '12px 14px', borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ ...S, height: 13, width: `${[40, 55, 35][i]}%`, animationDelay: `${i * 0.07}s` }} />
                  <div style={{ ...S, height: 11, width: `${[28, 38, 24][i]}%`, animationDelay: `${i * 0.07 + 0.1}s` }} />
                </div>
                <div style={{ ...S, width: 14, height: 14, borderRadius: 4, animationDelay: `${i * 0.07}s` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes skel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }`}</style>
    </div>
  );
}

export default function MemberDetailScreen() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const data = useQuery(
    api.members.getWithHistory,
    memberId ? { memberId: memberId as Id<'members'> } : 'skip',
  );

  // Hooks must be before any early returns
  const [histSearch, setHistSearch] = useState('');
  const [histSort, setHistSort] = useState<'newest' | 'oldest' | 'amount'>('newest');
  const [hutangOnly, setHutangOnly] = useState(false);

  const rawOrders = data?.orders ?? [];

  const sortedOrders = useMemo(() => {
    let result = [...rawOrders];
    if (hutangOnly) result = result.filter(o => o.balance > 0);
    if (histSearch.trim()) {
      const q = histSearch.toLowerCase();
      result = result.filter(o =>
        String(o.orderNumber).includes(q) ||
        o.date.includes(q) ||
        o.items.some(item =>
          item.productShortName.toLowerCase().includes(q) ||
          String(item.quantity).includes(q) ||
          `${item.quantity}${item.unit}`.includes(q)
        )
      );
    }
    if (histSort === 'newest') result.sort((a, b) => b.timestamp - a.timestamp);
    else if (histSort === 'oldest') result.sort((a, b) => a.timestamp - b.timestamp);
    else result.sort((a, b) => b.total - a.total);
    return result;
  }, [rawOrders, histSearch, histSort]);

  const groupedOrders = useMemo((): Array<[string, typeof sortedOrders]> | null => {
    if (histSort === 'amount') return null;
    const groups = new Map<string, typeof sortedOrders>();
    for (const order of sortedOrders) {
      const list = groups.get(order.date) ?? [];
      list.push(order);
      groups.set(order.date, list);
    }
    return [...groups.entries()];
  }, [sortedOrders, histSort]);

  if (data === undefined) return <MemberDetailSkeleton onBack={() => navigate(-1)} />;
  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '13px', color: '#9a9db5' }}>Anggota tidak ditemukan</span>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a90d9', fontSize: '13px', fontWeight: 600 }}>Kembali</button>
      </div>
    );
  }

  const { member, orders, totalOutstanding } = data;
  const color = member.color ?? getAvatarColor(member._id);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px var(--app-page-gutter) 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: '#eef0f5', boxShadow: SHD_RAISED, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <ArrowLeft size={16} color="#4a4e69" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em' }}>ANGGOTA</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#2d3142', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 var(--app-page-gutter) var(--app-content-bottom)', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Member card */}
        <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '14px', flexShrink: 0, background: `${color}1e`, boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {member.profileImageUrl
              ? <img src={member.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '16px', fontWeight: 800, color, lineHeight: 1 }}>{initials(member.name)}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#2d3142', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
            {member.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <Phone size={10} color="#c0c4d0" />
                <span style={{ fontSize: '12px', color: '#4a4e69' }}>{formatPhone(member.phone)}</span>
              </div>
            )}
          </div>
          {totalOutstanding > 0 && (
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: '#d4a017', fontWeight: 600, letterSpacing: '0.06em' }}>HUTANG</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#d4a017' }}>{formatRupiah(totalOutstanding)}</div>
            </div>
          )}
        </div>

        {/* Orders list */}
        <div>
          {/* Section label + sort controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600 }}>RIWAYAT PESANAN</div>
              {orders.some(o => o.balance > 0) && (
                <button
                  onClick={() => setHutangOnly(d => !d)}
                  style={{ fontSize: '10px', fontWeight: 700, color: hutangOnly ? '#d4a017' : '#c0c4d0', background: hutangOnly ? '#d4a01715' : 'transparent', border: `1px solid ${hutangOnly ? '#d4a01745' : 'transparent'}`, borderRadius: 20, padding: '2px 9px', cursor: 'pointer', transition: 'color 0.15s, background 0.15s, border-color 0.15s', fontFamily: 'inherit' }}
                >
                  Hutang{hutangOnly ? ' ×' : ''}
                </button>
              )}
            </div>
            {orders.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(['newest', 'oldest', 'amount'] as const).map((s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 && <span style={{ fontSize: '10px', color: '#c0c4d0', padding: '0 1px', userSelect: 'none' }}>·</span>}
                    <button
                      onClick={() => setHistSort(s)}
                      style={{
                        fontSize: '10px', fontWeight: histSort === s ? 700 : 400,
                        color: histSort === s ? '#4a4e69' : '#c0c4d0',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '8px 4px', lineHeight: 1, transition: 'color 0.15s',
                      }}
                    >
                      {s === 'newest' ? 'Terbaru' : s === 'oldest' ? 'Terlama' : 'Terbesar'}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Search bar */}
          {orders.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={12} color="#9a9db5" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Cari no. pesanan atau tanggal..."
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: '#eef0f5', boxShadow: SHD_RECESSED, borderRadius: 10, border: 'none', outline: 'none', padding: '8px 28px', fontSize: '12px', color: '#2d3142', fontFamily: 'inherit' }}
              />
              {histSearch && (
                <button onClick={() => setHistSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <X size={11} color="#9a9db5" />
                </button>
              )}
            </div>
          )}

          {orders.length === 0 ? (
            <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#c0c4d0' }}>Belum ada pesanan</span>
            </div>
          ) : sortedOrders.length === 0 ? (
            <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#c0c4d0' }}>Tidak ditemukan</span>
            </div>
          ) : groupedOrders !== null ? (
            /* Date-grouped view (newest / oldest sort) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupedOrders.map(([date, dateOrders]) => (
                <div key={date}>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: '#9a9db5', letterSpacing: '0.08em', marginBottom: 5, paddingLeft: 2 }}>
                    {formatDateHeader(date)}
                  </div>
                  <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
                    {dateOrders.map((order, i) => (
                      <div
                        key={order.id}
                        onClick={() => navigate(`/order/${order.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/order/${order.id}`); }}
                        style={{ padding: '11px 14px', borderBottom: i < dateOrders.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Chips row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {order.items.map((item, j) => {
                                const qtyLabel = item.unit === 'kg'
                                  ? ` ${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}kg`
                                  : item.plasticSize ? ` ${item.plasticSize}` : '';
                                return (
                                  <span key={j} style={{ fontSize: '10px', fontWeight: 600, color: item.color, background: `${item.color}18`, borderRadius: 5, padding: '1px 5px' }}>
                                    {item.productShortName}{qtyLabel}
                                  </span>
                                );
                              })}
                            </div>
                            {order.balance > 0 && (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: '#d4a017', background: '#d4a01722', borderRadius: 5, padding: '1px 6px', flexShrink: 0, marginLeft: 6 }}>
                                Sisa {formatRupiah(order.balance)}
                              </span>
                            )}
                          </div>
                          {/* Order number + time + total */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a4e69' }}>#{order.orderNumber}</span>
                              <span style={{ fontSize: '10px', color: '#c0c4d0' }}>·</span>
                              <span style={{ fontSize: '11px', color: '#9a9db5' }}>{formatTime(order.timestamp)}</span>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: order.balance > 0 ? '#d4a017' : '#2d3142' }}>{formatRupiah(order.total)}</span>
                          </div>
                        </div>
                        <ChevronRight size={14} color="#c0c4d0" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat view (amount sort) */
            <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
              {sortedOrders.map((order, i) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/order/${order.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/order/${order.id}`); }}
                  style={{ padding: '11px 14px', borderBottom: i < sortedOrders.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Chips row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {order.items.map((item, j) => {
                          const qtyLabel = item.unit === 'kg'
                            ? ` ${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}kg`
                            : item.plasticSize ? ` ${item.plasticSize}` : '';
                          return (
                            <span key={j} style={{ fontSize: '10px', fontWeight: 600, color: item.color, background: `${item.color}18`, borderRadius: 5, padding: '1px 5px' }}>
                              {item.productShortName}{qtyLabel}
                            </span>
                          );
                        })}
                      </div>
                      {order.balance > 0 && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#d4a017', background: '#d4a01722', borderRadius: 5, padding: '1px 6px', flexShrink: 0, marginLeft: 6 }}>
                          Sisa {formatRupiah(order.balance)}
                        </span>
                      )}
                    </div>
                    {/* Order number + date + total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#4a4e69' }}>#{order.orderNumber}</span>
                        <span style={{ fontSize: '10px', color: '#c0c4d0' }}>·</span>
                        <span style={{ fontSize: '11px', color: '#9a9db5' }}>{formatDateHeader(order.date)}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: order.balance > 0 ? '#d4a017' : '#2d3142' }}>{formatRupiah(order.total)}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} color="#c0c4d0" />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
