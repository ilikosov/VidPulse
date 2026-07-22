import type { ReactNode, CSSProperties } from 'react';

export interface CardProps {
  title?: ReactNode;
  extra?: ReactNode;
  size?: 'small' | 'default';
  hoverable?: boolean;
  bordered?: boolean;
  loading?: boolean;
  style?: CSSProperties;
  className?: string;
  styles?: { body?: CSSProperties };
  bodyStyle?: CSSProperties;
  cover?: ReactNode;
  actions?: ReactNode[];
  children?: ReactNode;
  [key: string]: unknown;
}

export function Card({
  title,
  extra,
  hoverable,
  style,
  className,
  styles,
  bodyStyle,
  cover,
  actions,
  children,
}: CardProps) {
  return (
    <div
      className={`kp-card2${hoverable ? ' kp-vcard' : ''}${className ? ' ' + className : ''}`}
      style={style}
    >
      {cover}
      {title && (
        <div className="kp-card2-head">
          <span>{title}</span>
          {extra}
        </div>
      )}
      <div className="kp-card2-body" style={{ ...styles?.body, ...bodyStyle }}>
        {children}
      </div>
      {actions && actions.length > 0 && (
        <div className="kp-card2-actions">
          {actions.map((a, i) => (
            <span key={i}>{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}
