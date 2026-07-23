// Store de toasts (estilo sonner) — sem dependência, usável de qualquer client component.
export type ToastTipo = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  tipo: ToastTipo;
  texto: string;
}

let itens: ToastItem[] = [];
let seq = 1;
const subs = new Set<(t: ToastItem[]) => void>();

function emit() {
  subs.forEach((s) => s(itens));
}

export function subscribeToasts(cb: (t: ToastItem[]) => void) {
  subs.add(cb);
  cb(itens);
  return () => {
    subs.delete(cb);
  };
}

export function dismissToast(id: number) {
  itens = itens.filter((t) => t.id !== id);
  emit();
}

function push(tipo: ToastTipo, texto: string) {
  const id = seq++;
  itens = [...itens, { id, tipo, texto }];
  emit();
  setTimeout(() => dismissToast(id), 4000);
  return id;
}

export const toast = {
  success: (texto: string) => push('success', texto),
  error: (texto: string) => push('error', texto),
  info: (texto: string) => push('info', texto),
};
