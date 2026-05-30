export function tap(ms = 30) {
  try { navigator.vibrate?.(ms); } catch {}
}

export function softTap() { tap(22); }
export function confirmTap() { tap(50); }
