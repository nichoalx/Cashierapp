import React, { useState } from 'react';
import { Delete, Plus, Check } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  onAddItem: () => void;
  onComplete: () => void;
  canAdd: boolean;
  canComplete: boolean;
  allowDecimal?: boolean;
}

function NumKey({ label, onClick, style, children, disabled }: {
  label?: string;
  onClick: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const isDown = React.useRef(false);

  const handleDown = () => {
    if (disabled) return;
    isDown.current = true;
    setPressed(true);
  };
  const handleUp = () => {
    const fire = isDown.current && !disabled;
    isDown.current = false;
    setPressed(false);
    if (fire) onClick();
  };
  const handleLeave = () => {
    isDown.current = false;
    setPressed(false);
  };

  return (
    <button
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleLeave}
      onPointerCancel={handleLeave}
      style={{
        background: pressed ? '#e0e3eb' : '#eef0f5',
        boxShadow: pressed
          ? 'inset 3px 3px 7px #bec1c8, inset -3px -3px 7px #f8f9fc'
          : '5px 5px 10px #c8cad1, -4px -4px 9px #ffffff',
        borderRadius: '12px',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.07s, background 0.07s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: disabled ? 0.32 : 1,
        ...style,
      }}
    >
      {children ?? <span style={{ fontSize: '20px', fontWeight: 600, color: '#3a3d52', lineHeight: 1 }}>{label}</span>}
    </button>
  );
}

function ActionKey({ icon, onClick, color, disabled, style }: {
  icon: React.ReactNode;
  onClick: () => void;
  color: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [pressed, setPressed] = useState(false);
  const isDown = React.useRef(false);

  const handleDown = () => {
    if (disabled) return;
    isDown.current = true;
    setPressed(true);
  };
  const handleUp = () => {
    const fire = isDown.current && !disabled;
    isDown.current = false;
    setPressed(false);
    if (fire) onClick();
  };
  const handleLeave = () => {
    isDown.current = false;
    setPressed(false);
  };

  return (
    <button
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleLeave}
      onPointerCancel={handleLeave}
      style={{
        background: color,
        boxShadow: pressed && !disabled
          ? 'inset 3px 3px 8px rgba(0,0,0,0.22), inset -2px -2px 5px rgba(255,255,255,0.15)'
          : '4px 4px 10px rgba(0,0,0,0.16), -3px -3px 8px rgba(255,255,255,0.5)',
        borderRadius: '14px',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'box-shadow 0.07s, transform 0.07s',
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

export function Numpad({ value, onChange, onAddItem, onComplete, canAdd, canComplete, allowDecimal = true }: NumpadProps) {

  const handleDigit = (d: string) => {
    if (d === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value + '.');
      return;
    }
    if (value === '0') { onChange(d); return; }
    const dotIdx = value.indexOf('.');
    if (dotIdx !== -1 && value.length - dotIdx - 1 >= 3) return;
    if (value.length >= 10) return;
    onChange(value + d);
  };

  const handleBack = () => {
    const next = value.length <= 1 ? '0' : value.slice(0, -1);
    onChange(next);
  };

  return (
    <div style={{
      background: '#eef0f5',
      borderRadius: '20px',
      padding: '14px',
      boxShadow: '5px 5px 14px #c0c3ca, -5px -5px 14px #ffffff',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridAutoRows: '52px',
        gap: 9,
      }}>
        {/* Row 1 */}
        <NumKey label="7" onClick={() => handleDigit('7')} />
        <NumKey label="8" onClick={() => handleDigit('8')} />
        <NumKey label="9" onClick={() => handleDigit('9')} />
        <NumKey onClick={handleBack} style={{ background: '#dde0e8' }}>
          <Delete size={17} color="#8a8fa8" />
        </NumKey>

        {/* Rows 2–3, cols 1–3 */}
        <NumKey label="4" onClick={() => handleDigit('4')} />
        <NumKey label="5" onClick={() => handleDigit('5')} />
        <NumKey label="6" onClick={() => handleDigit('6')} />

        <NumKey label="1" onClick={() => handleDigit('1')} />
        <NumKey label="2" onClick={() => handleDigit('2')} />
        <NumKey label="3" onClick={() => handleDigit('3')} />

        {/* Row 4, cols 1–3 */}
        <NumKey label="0" onClick={() => handleDigit('0')} style={{ gridColumn: 'span 2' }} />
        <NumKey label="." onClick={() => handleDigit('.')} disabled={!allowDecimal} />

        {/* Tambah — col 4, rows 2–3 */}
        <ActionKey
          icon={<Plus size={22} color="#fff" />}
          onClick={onAddItem}
          color={canAdd ? '#4a90d9' : '#a8acbe'}
          disabled={!canAdd}
          style={{ gridColumn: 4, gridRow: '2 / 4', height: 'auto' }}
        />

        {/* Selesai — col 4, row 4 */}
        <ActionKey
          icon={<Check size={20} color="#fff" />}
          onClick={onComplete}
          color={canComplete ? '#52b96a' : '#a8acbe'}
          disabled={!canComplete}
          style={{ gridColumn: 4, gridRow: 4 }}
        />
      </div>
    </div>
  );
}
