import type { ReactNode } from 'react';
interface NotificationOpts {
  message: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}
type Listener = (items: (NotificationOpts & { id: number })[]) => void;
let items: (NotificationOpts & { id: number })[] = [];
let listeners: Listener[] = [];
function emit() {
  listeners.forEach((l) => l(items));
}
export const notification = {
  open: (opts: NotificationOpts) => {
    const id = Date.now() + Math.random();
    items = [...items, { id, ...opts }];
    emit();
    setTimeout(() => {
      items = items.filter((x) => x.id !== id);
      emit();
    }, 4200);
  },
  subscribe: (l: Listener) => {
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  },
};
