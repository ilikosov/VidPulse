import type { ReactNode, CSSProperties } from 'react';

interface EmptyProps {
  description?: ReactNode;
  image?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
}

function EmptyBase({ description = 'Ничего не найдено', children, style, className }: EmptyProps) {
  return (
    <div className={`kp-empty${className ? ' ' + className : ''}`} style={style}>
      <svg
        viewBox="0 0 24 24"
        width={44}
        height={44}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-5 9 5-9 5-9-5Z" />
        <path d="M3 9v7l9 5 9-5V9M12 14v5" />
      </svg>
      <div className="kp-empty-text">{description}</div>
      {children}
    </div>
  );
}

export const Empty = Object.assign(EmptyBase, {
  PRESENTED_IMAGE_SIMPLE: undefined as ReactNode,
  PRESENTED_IMAGE_DEFAULT: undefined as ReactNode,
});
