import React, { useState, useRef } from 'react';
import { Delete, Plus, Check } from 'lucide-react';
import { useCompact } from '../hooks/useCompact';

interface NumpadProps {
  value: string;
  onChange: (val: string) => void;
  onAddItem: () => void;
  onComplete: () => void;
  canAdd: boolean;
  canComplete: boolean;
  allowDecimal?: boolean;
  maxValue?: number;
}

function NumKey({ label, onClick, style, children, disabled, compact }: {
  label?: string;
  onClick: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  disabled?: boolean;
  compact?: boolean;
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
      {children ?? <span style={{ fontSize: compact ? '17px' : '20px', fontWeight: 600, color: '#3a3d52', lineHeight: 1 }}>{label}</span>}
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

export function Numpad({ value, onChange, onAddItem, onComplete, canAdd, canComplete, allowDecimal = true, maxValue }: NumpadProps) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHoldRef = useRef(false);
  const [zeroDotPressed, setZeroDotPressed] = useState(false);
  const compact = useCompact();

  const handleDigit = (d: string) => {
    if (d === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value + '.');
      return;
    }
    const next = value === '0' ? d : value + d;
    const dotIdx = next.indexOf('.');
    if (dotIdx !== -1 && next.length - dotIdx - 1 > 3) return;
    if (next.replace('.', '').length > 10) return;
    if (maxValue !== undefined && parseFloat(next) > maxValue) return;
    onChange(next);
  };

  const handleBack = () => {
    const next = value.length <= 1 ? '0' : value.slice(0, -1);
    onChange(next);
  };

  const digitDisabled = (d: string) => {
    if (maxValue === undefined) return false;
    const next = value === '0' ? d : value + d;
    return parseFloat(next) > maxValue;
  };

  const zeroDotDisabled = digitDisabled('0');
  const dotDisabled = !allowDecimal || value.includes('.');

  const handleZeroDotDown = () => {
    if (zeroDotDisabled) return;
    setZeroDotPressed(true);
    didHoldRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      didHoldRef.current = true;
      if (!dotDisabled) handleDigit('.');
    }, 500);
  };

  const handleZeroDotUp = () => {
    setZeroDotPressed(false);
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (!didHoldRef.current && !zeroDotDisabled) handleDigit('0');
    didHoldRef.current = false;
  };

  const handleZeroDotCancel = () => {
    setZeroDotPressed(false);
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    didHoldRef.current = false;
  };

  return (
    <div style={{
      background: '#eef0f5',
      borderRadius: compact ? '16px' : '20px',
      padding: compact ? '10px' : '14px',
      boxShadow: '5px 5px 14px #c0c3ca, -5px -5px 14px #ffffff',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridAutoRows: compact ? '44px' : '52px',
        gap: compact ? 7 : 9,
      }}>
        {/* Row 1 */}
        <NumKey label="7" onClick={() => handleDigit('7')} disabled={digitDisabled('7')} compact={compact} />
        <NumKey label="8" onClick={() => handleDigit('8')} disabled={digitDisabled('8')} compact={compact} />
        <NumKey label="9" onClick={() => handleDigit('9')} disabled={digitDisabled('9')} compact={compact} />
        <NumKey onClick={handleBack} style={{ background: '#dde0e8' }}>
          <Delete size={compact ? 14 : 17} color="#8a8fa8" />
        </NumKey>

        {/* Rows 2–3, cols 1–3 */}
        <NumKey label="4" onClick={() => handleDigit('4')} disabled={digitDisabled('4')} compact={compact} />
        <NumKey label="5" onClick={() => handleDigit('5')} disabled={digitDisabled('5')} compact={compact} />
        <NumKey label="6" onClick={() => handleDigit('6')} disabled={digitDisabled('6')} compact={compact} />

        <NumKey label="1" onClick={() => handleDigit('1')} disabled={digitDisabled('1')} compact={compact} />
        <NumKey label="2" onClick={() => handleDigit('2')} disabled={digitDisabled('2')} compact={compact} />
        <NumKey label="3" onClick={() => handleDigit('3')} disabled={digitDisabled('3')} compact={compact} />

        {/* Row 4, cols 1–3: 0/. long-press key spanning all 3 cols */}
        <button
          onPointerDown={handleZeroDotDown}
          onPointerUp={handleZeroDotUp}
          onPointerLeave={handleZeroDotCancel}
          onPointerCancel={handleZeroDotCancel}
          disabled={zeroDotDisabled}
          style={{
            gridColumn: 'span 3',
            background: zeroDotPressed ? '#e0e3eb' : '#eef0f5',
            boxShadow: zeroDotPressed
              ? 'inset 3px 3px 7px #bec1c8, inset -3px -3px 7px #f8f9fc'
              : '5px 5px 10px #c8cad1, -4px -4px 9px #ffffff',
            borderRadius: '12px',
            border: 'none',
            cursor: zeroDotDisabled ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            opacity: zeroDotDisabled ? 0.32 : 1,
            transition: 'box-shadow 0.07s, background 0.07s',
          }}
        >
          <span style={{ fontSize: compact ? '17px' : '20px', fontWeight: 600, color: '#3a3d52', lineHeight: 1 }}>0</span>
          {allowDecimal && (
            <span style={{ fontSize: '13px', fontWeight: 500, color: dotDisabled ? '#c0c4d0' : '#9a9db5', lineHeight: 1 }}>/ .</span>
          )}
        </button>

        {/* Tambah — col 4, rows 2–3 */}
        <ActionKey
          icon={<Plus size={compact ? 18 : 22} color="#fff" />}
          onClick={onAddItem}
          color={canAdd ? '#4a90d9' : '#a8acbe'}
          disabled={!canAdd}
          style={{ gridColumn: 4, gridRow: '2 / 4', height: 'auto' }}
        />

        {/* Selesai — col 4, row 4 */}
        <ActionKey
          icon={<Check size={compact ? 17 : 20} color="#fff" />}
          onClick={onComplete}
          color={canComplete ? '#52b96a' : '#a8acbe'}
          disabled={!canComplete}
          style={{ gridColumn: 4, gridRow: 4 }}
        />
      </div>
    </div>
  );
}
