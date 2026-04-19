import React, { useState } from 'react';
import { Delete } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  onAddItem: () => void;
  onComplete: () => void;
  canAdd: boolean;
  canComplete: boolean;
}

function NumKey({ label, onClick, style, children }: {
  label?: string;
  onClick: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: pressed ? '#e0e3eb' : '#eef0f5',
        boxShadow: pressed
          ? 'inset 3px 3px 7px #bec1c8, inset -3px -3px 7px #f8f9fc'
          : '5px 5px 10px #c8cad1, -4px -4px 9px #ffffff',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.07s, background 0.07s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...style,
      }}
    >
      {children ?? <span style={{ fontSize: '20px', fontWeight: 600, color: '#3a3d52', lineHeight: 1 }}>{label}</span>}
    </button>
  );
}

function ActionKey({ label, onClick, color, style }: {
  label: string;
  onClick: () => void;
  color: string;
  style?: React.CSSProperties;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick(); }}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: color,
        boxShadow: pressed
          ? `inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)`
          : `4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)`,
        borderRadius: '14px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.07s, transform 0.07s',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...style,
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>{label}</span>
    </button>
  );
}

export function Numpad({ value, onChange, onAddItem, onComplete, canAdd, canComplete }: NumpadProps) {

  const handleDigit = (d: string) => {
    if (d === '.' && value.includes('.')) return;
    if (value === '0' && d !== '.') { onChange(d); return; }
    if (value.length >= 10) return;
    onChange(value + d);
  };

  const handleBack = () => {
    const next = value.length <= 1 ? '0' : value.slice(0, -1);
    onChange(next);
  };

  const keyH = 52;

  return (
    <div style={{
      background: '#e4e7ef',
      borderRadius: '20px',
      padding: '14px',
      boxShadow: '8px 8px 18px #c0c3ca, -8px -8px 18px #ffffff',
    }}>
      {/* Keys grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9, marginBottom: 9 }}>
        <NumKey label="7" onClick={() => handleDigit('7')} style={{ height: keyH }} />
        <NumKey label="8" onClick={() => handleDigit('8')} style={{ height: keyH }} />
        <NumKey label="9" onClick={() => handleDigit('9')} style={{ height: keyH }} />
        <NumKey onClick={handleBack} style={{ height: keyH, background: '#dde0e8' }}>
          <Delete size={17} color="#8a8fa8" />
        </NumKey>

        <NumKey label="4" onClick={() => handleDigit('4')} style={{ height: keyH }} />
        <NumKey label="5" onClick={() => handleDigit('5')} style={{ height: keyH }} />
        <NumKey label="6" onClick={() => handleDigit('6')} style={{ height: keyH }} />
        <div />

        <NumKey label="1" onClick={() => handleDigit('1')} style={{ height: keyH }} />
        <NumKey label="2" onClick={() => handleDigit('2')} style={{ height: keyH }} />
        <NumKey label="3" onClick={() => handleDigit('3')} style={{ height: keyH }} />
        <div />

        <NumKey label="0" onClick={() => handleDigit('0')} style={{ height: keyH, gridColumn: 'span 2' }} />
        <NumKey label="." onClick={() => handleDigit('.')} style={{ height: keyH }} />
        <div />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <ActionKey
          label="+ Tambah Item"
          onClick={onAddItem}
          color={canAdd ? '#52b96a' : '#a8acbe'}
          style={{ height: 46, opacity: canAdd ? 1 : 0.55 }}
        />
        <ActionKey
          label="✓ Selesai"
          onClick={onComplete}
          color={canComplete ? '#4a90d9' : '#a8acbe'}
          style={{ height: 46, opacity: canComplete ? 1 : 0.55 }}
        />
      </div>
    </div>
  );
}