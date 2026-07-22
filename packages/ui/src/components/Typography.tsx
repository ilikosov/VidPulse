import type { ReactNode, CSSProperties } from 'react';

interface TitleProps {
  level?: 1 | 2 | 3 | 4 | 5;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}
function Title({ level = 1, style, className, children }: TitleProps) {
  return (
    <div className={`kp-h${Math.min(level, 3)}${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  );
}

interface TextProps {
  type?: 'secondary' | 'danger' | 'success' | 'warning';
  strong?: boolean;
  italic?: boolean;
  underline?: boolean;
  delete?: boolean;
  code?: boolean;
  keyboard?: boolean;
  mark?: boolean;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}
function Text({
  type,
  strong,
  italic,
  underline,
  delete: del,
  code,
  keyboard,
  mark,
  style,
  className,
  children,
}: TextProps) {
  const cls = [
    type === 'secondary' && 'kp-txt-secondary',
    type === 'danger' && 'kp-txt-danger',
    type === 'success' && 'kp-txt-success',
    type === 'warning' && 'kp-txt-warning',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <span
      className={cls || undefined}
      style={{
        fontWeight: strong ? 700 : undefined,
        fontStyle: italic ? 'italic' : undefined,
        textDecoration: underline ? 'underline' : del ? 'line-through' : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
  if (code) return <code className="kp-code">{inner}</code>;
  if (keyboard) return <kbd className="kp-kbd">{inner}</kbd>;
  if (mark) return <mark>{inner}</mark>;
  return inner;
}

interface ParagraphProps {
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}
function Paragraph({ style, className, children }: ParagraphProps) {
  return (
    <p className={`kp-p${className ? ' ' + className : ''}`} style={style}>
      {children}
    </p>
  );
}

function Link({
  style,
  className,
  children,
  ...rest
}: { style?: CSSProperties; className?: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <a className={`kp-link${className ? ' ' + className : ''}`} style={style} {...(rest as object)}>
      {children}
    </a>
  );
}

export const Typography = { Title, Text, Paragraph, Link };
