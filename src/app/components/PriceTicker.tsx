import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { formatRupiah } from '../store';

interface PriceTickerProps {
  onOpenPriceEditor: () => void;
}

export function PriceTicker({ onOpenPriceEditor }: PriceTickerProps) {
  const rawProducts = useQuery(api.products.listWithPrices);

  const items = rawProducts == null ? [] : [
    ...rawProducts
      .filter(p => p.unit === 'kg' && p.name !== 'E')
      .map(p => ({ label: p.name, price: `${formatRupiah(p.price)}/kg`, color: p.color })),
    ...(rawProducts.find(p => p.name === 'E')
      ? [{ label: 'E', price: `${formatRupiah(rawProducts.find(p => p.name === 'E')!.price)}/kg`, color: '#9b6dff' }]
      : []),
    ...rawProducts
      .filter(p => p.unit === 'pcs' && p.variants.length === 0)
      .map(p => ({ label: p.name, price: `${formatRupiah(p.price)}/pcs`, color: p.color })),
    ...rawProducts
      .filter(p => p.variants.length > 0)
      .map(p => ({ label: p.name, price: `${formatRupiah(p.variants[0]?.price ?? 0)}/pcs`, color: p.color })),
  ];

  const content = [...items, ...items];

  return (
    <button
      onClick={onOpenPriceEditor}
      className="w-full overflow-hidden cursor-pointer group"
      style={{
        background: '#eef0f5',
        boxShadow: 'inset 3px 3px 6px #c8cad1, inset -3px -3px 6px #ffffff',
        borderRadius: '14px',
        padding: '10px 16px',
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: '10px', color: '#8a8fa8', letterSpacing: '0.08em', whiteSpace: 'nowrap', flexShrink: 0 }}>
          HARGA
        </span>
        <div className="overflow-hidden flex-1 relative">
          {items.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#c0c4d0' }}>
              {rawProducts == null ? 'Memuat...' : 'Belum ada produk'}
            </span>
          ) : (
            <div
              className="flex gap-4 items-center"
              style={{ animation: 'ticker-scroll 28s linear infinite', width: 'max-content' }}
            >
              {content.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5 shrink-0">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#4a4e69', whiteSpace: 'nowrap' }}>
                    <strong>{item.label}</strong> {item.price}
                  </span>
                  <span style={{ color: '#c0c4d0', fontSize: '12px' }}>•</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: '9px', color: '#b0b4c8', flexShrink: 0 }}>▶ Edit</span>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </button>
  );
}
