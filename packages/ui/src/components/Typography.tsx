import type { ReactNode, CSSProperties } from 'react';

function Title({
  level = 1,
  style,
  children,
}: {
  level?: 1 | 2 | 3 | 4 | 5;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={`kp-h${Math.min(level, 3)}`} style={style}>
      {children}
    </div>
  );
}
function Text({
  type,
  strong,
  style,
  children,
}: {
  type?: 'secondary' | 'danger';
  strong?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <span
      className={
        type === 'secondary' ? 'kp-txt-secondary' : type === 'danger' ? 'kp-txt-danger' : ''
      }
      style={{ fontWeight: strong ? 700 : 400, ...style }}
    >
      {children}
    </span>
  );
}
function Paragraph({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return (
    <p className="kp-p" style={style}>
      {children}
    </p>
  );
}

export const Typography = { Title, Text, Paragraph };
