interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}
type Listener = (toasts: Toast[]) => void;
let toasts: Toast[] = [];
let listeners: Listener[] = [];
function emit() {
  listeners.forEach((l) => l(toasts));
}
function push(type: Toast['type'], text: string) {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, type, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}
export const message = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
  info: (text: string) => push('info', text),
  warning: (text: string) => push('warning', text),
  subscribe: (l: Listener) => {
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  },
};
