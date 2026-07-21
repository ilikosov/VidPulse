import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonType = 'primary' | 'default' | 'dashed' | 'text' | 'link';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  type?: ButtonType;
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
};
const SIZE: Record<string, string> = { small: 'kp-btn--sm', large: 'kp-btn--lg' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = 'default',
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
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {icon}
      {children}
    </button>
  );
});
