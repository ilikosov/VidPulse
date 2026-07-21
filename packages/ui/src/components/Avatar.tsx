import type { ReactNode, CSSProperties } from 'react';
import { Children } from 'react';

export interface AvatarProps {
  src?: string;
  size?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Avatar({ src, size = 32, style, children }: AvatarProps) {
  return (
    <span className="kp-av" style={{ width: size, height: size, fontSize: size * 0.4, ...style }}>
      {src ? <img src={src} alt="" /> : children}
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
