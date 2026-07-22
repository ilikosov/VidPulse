import type { ReactNode, CSSProperties } from 'react';
import { Children } from 'react';

export interface AvatarProps {
  src?: string;
  size?: number | 'small' | 'default' | 'large';
  shape?: 'circle' | 'square';
  icon?: ReactNode;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

const SIZE: Record<string, number> = { small: 24, default: 32, large: 40 };

export function Avatar({
  src,
  size = 32,
  shape = 'circle',
  icon,
  style,
  className,
  children,
}: AvatarProps) {
  const px = typeof size === 'string' ? SIZE[size] : size;
  return (
    <span
      className={`kp-av${shape === 'square' ? ' kp-av--square' : ''}${className ? ' ' + className : ''}`}
      style={{ width: px, height: px, fontSize: px * 0.4, ...style }}
    >
      {src ? <img src={src} alt="" /> : (icon ?? children)}
    </span>
  );
}

function AvatarGroup({ children, max }: { children: ReactNode; max?: { count: number } }) {
  const kids = Children.toArray(children);
  const shown = max ? kids.slice(0, max.count) : kids;
  const rest = kids.length - shown.length;
  return (
    <span className="kp-av-group">
      {shown}
      {rest > 0 && (
        <Avatar style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
          +{rest}
        </Avatar>
      )}
    </span>
  );
}
Avatar.Group = AvatarGroup;
