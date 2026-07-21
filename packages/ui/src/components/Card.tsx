import type { ReactNode, CSSProperties } from 'react';

export interface CardProps {
  title?: ReactNode;
  extra?: ReactNode;
  size?: 'small' | 'default';
  hoverable?: boolean;
  style?: CSSProperties;
  styles?: { body?: CSSProperties };
  cover?: ReactNode;
  children?: ReactNode;
}

export function Card({ title, extra, hoverable, style, styles, cover, children }: CardProps) {
  return (
    <div className={`kp-card2${hoverable ? ' kp-vcard' : ''}`} style={style}>
      {cover}
      {title && (
        <div className="kp-card2-head">
          <span>{title}</span>
          {extra}
        </div>
      )}
      <div className="kp-card2-body" style={styles?.body}>
        {children}
      </div>
    </div>
  );
}
