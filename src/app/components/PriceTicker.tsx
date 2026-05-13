import React, { useRef, useEffect } from 'react';
import { useAppStore, formatRupiah } from '../store';

interface PriceTickerProps {
  onOpenPriceEditor: () => void;
}

export function PriceTicker({ onOpenPriceEditor }: PriceTickerProps) {
  const { soybeanProducts, otherProducts, plasticSizes, eceranPrice } = useAppStore();

  const items = [
    ...soybeanProducts.map(p => ({ label: p.name, price: `${formatRupiah(p.price)}/kg`, color: p.color })),
    { label: 'E', price: `${formatRupiah(eceranPrice)}/kg`, color: '#9b6dff' },
    ...otherProducts.map(p => ({ label: p.name, price: `${formatRupiah(p.price)}/pcs`, color: p.color })),
    ...plasticSizes.map(p => ({ label: `P ${p.size}`, price: `${formatRupiah(p.price)}/pcs`, color: '#38b2ac' })),
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
          <div
            className="flex gap-4 items-center"
            style={{
              animation: 'ticker-scroll 28s linear infinite',
              width: 'max-content',
            }}
          >
            {content.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5 shrink-0">
                <span
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: item.color, display: 'inline-block', flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', color: '#4a4e69', whiteSpace: 'nowrap' }}>
                  <strong>{item.label}</strong> {item.price}
                </span>
                <span style={{ color: '#c0c4d0', fontSize: '12px' }}>•</span>
              </span>
            ))}
          </div>
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
