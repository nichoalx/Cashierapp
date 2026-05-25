import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { formatRupiah } from '../store';
import { ArrowLeft, Phone, ChevronRight } from 'lucide-react';

const SHD_RAISED = '4px 4px 9px #c8cad1, -4px -4px 9px #ffffff';
const SHD_LIST   = '3px 3px 7px #c8cad1, -3px -3px 7px rgba(255,255,255,0.92)';

const AVATAR_COLORS = [
  '#f5903d', '#4a90d9', '#52b96a', '#9b6dff',
  '#e05a6a', '#38b2ac', '#d4a017', '#e84393',
];

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

export default function MemberDetailScreen() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const data = useQuery(
    api.members.getWithHistory,
    memberId ? { memberId: memberId as Id<'members'> } : 'skip',
  );

  if (data === undefined) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', color: '#9a9db5' }}>Memuat...</span>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '13px', color: '#9a9db5' }}>Anggota tidak ditemukan</span>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a90d9', fontSize: '13px', fontWeight: 600 }}>Kembali</button>
      </div>
    );
  }

  const { member, orders, totalOutstanding } = data;
  const color = getAvatarColor(member._id);

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
          <div style={{ width: 52, height: 52, borderRadius: '14px', flexShrink: 0, background: `${color}1e`, boxShadow: '3px 3px 7px #c8cad1, -3px -3px 7px #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color, lineHeight: 1 }}>{initials(member.name)}</span>
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
          <div style={{ fontSize: '9px', color: '#9a9db5', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>RIWAYAT PESANAN</div>
          {orders.length === 0 ? (
            <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#c0c4d0' }}>Belum ada pesanan</span>
            </div>
          ) : (
            <div style={{ background: '#eef0f5', boxShadow: SHD_RAISED, borderRadius: 14, overflow: 'hidden' }}>
              {orders.map((order, i) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/order/${order.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/order/${order.id}`); }}
                  style={{
                    padding: '12px 14px',
                    borderBottom: i < orders.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#2d3142' }}>#{order.orderNumber}</span>
                      <span style={{ fontSize: '11px', color: '#9a9db5' }}>{order.date}</span>
                    </div>
                    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#4a4e69' }}>{formatRupiah(order.total)}</span>
                      {order.balance > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#d4a017', background: '#d4a01722', borderRadius: 5, padding: '1px 6px' }}>
                          Sisa {formatRupiah(order.balance)}
                        </span>
                      )}
                      {order.balance <= 0 && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#52b96a' }}>Lunas</span>
                      )}
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
