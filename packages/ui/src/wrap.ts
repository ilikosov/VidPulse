import { createElement, forwardRef, type ElementType } from 'react';

// React-internal / component-mechanics keys that must NOT be copied from the antd component onto our
// wrapper (they'd corrupt the wrapper's own element identity or re-trigger deprecated defaultProps).
const SKIP_KEYS = new Set([
  '$$typeof',
  'render',
  'compare',
  'type',
  '_payload',
  '_init',
  'defaultProps',
  'propTypes',
  'displayName',
]);

/**
 * Wrap an Ant Design component so it is owned by @vidpulse/ui: forward every prop (and the ref, when
 * a consumer passes one) and copy across the compound statics the app relies on (Form.Item,
 * Layout.Header, Typography.Text, Form.useForm, …). The generic return type keeps antd's exact type —
 * including generics (Table<T>, Select<T>) and statics — so the app type-checks exactly as before.
 *
 * This is the migration seam: to move a component off antd, replace its file's body with a custom
 * implementation — nothing else in the app changes.
 */
export function wrap<T>(Component: T, displayName: string): T {
  const Wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) =>
    createElement(Component as unknown as ElementType, ref == null ? props : { ...props, ref }),
  );
  Wrapped.displayName = displayName;

  const source = Component as unknown as Record<string, unknown>;
  const target = Wrapped as unknown as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!SKIP_KEYS.has(key)) target[key] = source[key];
  }
  return Wrapped as unknown as T;
}
