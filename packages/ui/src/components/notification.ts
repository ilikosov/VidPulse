import type { ReactNode } from 'react';

export interface NotificationOpts {
  message: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  duration?: number;
  key?: string;
  placement?: string;
  [key: string]: unknown;
}
type Item = NotificationOpts & { id: number; type: 'info' | 'success' | 'error' | 'warning' };
type Listener = (items: Item[]) => void;

let items: Item[] = [];
let listeners: Listener[] = [];
function emit() {
  listeners.forEach((l) => l(items));
}
function open(type: Item['type'], opts: NotificationOpts) {
  const id = Date.now() + Math.random();
  items = [...items, { id, type, ...opts }];
  emit();
  setTimeout(
    () => {
      items = items.filter((x) => x.id !== id);
      emit();
    },
    (opts.duration ?? 4.2) * 1000,
  );
}

export const notification = {
  open: (opts: NotificationOpts) => open('info', opts),
  info: (opts: NotificationOpts) => open('info', opts),
  success: (opts: NotificationOpts) => open('success', opts),
  error: (opts: NotificationOpts) => open('error', opts),
  warning: (opts: NotificationOpts) => open('warning', opts),
  subscribe: (l: Listener) => {
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  },
};
