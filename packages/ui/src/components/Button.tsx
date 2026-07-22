import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonType = 'primary' | 'default' | 'dashed' | 'text' | 'link';

// Omit the DOM `type` (button/submit/reset) — `type` here is the visual variant. The native button
// type is set via `htmlType`. `href` renders an <a> styled as a button (used by link-style buttons).
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  type?: ButtonType;
  htmlType?: 'button' | 'submit' | 'reset';
  href?: string;
  target?: string;
  download?: boolean | string;
  variant?: string;
  color?: string;
  danger?: boolean;
  ghost?: boolean;
  size?: 'small' | 'middle' | 'large';
  shape?: 'default' | 'round' | 'circle';
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

const VARIANT: Record<string, string> = {
  primary: 'kp-btn--primary',
  default: 'kp-btn--default',
  dashed: 'kp-btn--dashed',
  text: 'kp-btn--text',
  link: 'kp-btn--text',
  danger: 'kp-btn--danger',
  'ghost-danger': 'kp-btn--danger',
};
const SIZE: Record<string, string> = { small: 'kp-btn--sm', large: 'kp-btn--lg' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = 'default',
    htmlType = 'button',
    href,
    target,
    download,
    variant: _variant,
    color: _color,
    danger,
    ghost,
    size = 'middle',
    shape,
    icon,
    loading,
    block,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const variant = danger ? (ghost ? 'ghost-danger' : 'danger') : type;
  const cls = [
    'kp-btn',
    VARIANT[variant] || 'kp-btn--default',
    SIZE[size] || '',
    block ? 'kp-btn--block' : '',
    shape === 'circle' && !children ? 'kp-btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href != null) {
    return (
      <a
        className={cls}
        href={href}
        target={target}
        download={download as never}
        aria-disabled={disabled || loading || undefined}
        {...(rest as ButtonHTMLAttributes<HTMLAnchorElement>)}
      >
        {icon}
        {children}
      </a>
    );
  }

  return (
    <button ref={ref} type={htmlType} className={cls} disabled={disabled || loading} {...rest}>
      {icon}
      {children}
    </button>
  );
});
