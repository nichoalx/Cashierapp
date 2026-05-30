export function tap(ms = 9) {
  try { navigator.vibrate?.(ms); } catch {}
}

export function softTap() { tap(6); }
export function confirmTap() { tap(18); }
