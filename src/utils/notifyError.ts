import { toast } from 'sonner';

/**
 * Show a failed Convex call to the cashier instead of only logging it.
 * Convex wraps server errors as "[CONVEX M(fn)] [Request ID: …] Server Error"
 * followed by "Uncaught Error: <message>" and a stack — surface just the
 * thrown message (e.g. "Stok tidak cukup: SBS. Tambah stok dulu.").
 */
export function notifyError(title: string, e: unknown) {
  console.error(e);
  const raw = e instanceof Error ? e.message : String(e);
  const thrown = raw.match(/Uncaught (?:Convex)?Error: ([^\n]+)/)?.[1];
  toast.error(title, { description: thrown ?? 'Coba lagi.' });
}
