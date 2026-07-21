import type { ReactNode } from 'react';

const COLOR_TONE: Record<string, string> = {
  magenta: 'accent',
  pink: 'accent',
  purple: 'lav',
  geekblue: 'lav',
  green: 'mint',
  success: 'mint',
  processing: 'lav',
  gold: '',
  warning: '',
  red: 'ghost-danger',
  error: 'ghost-danger',
};

export interface TagProps {
  color?: string;
  icon?: ReactNode;
  closable?: boolean;
  onClose?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  children?: ReactNode;
}

export function Tag({ color, icon, closable, onClose, style, children }: TagProps) {
  const tone = color ? (COLOR_TONE[color] ?? '') : '';
  return (
    <span className={`kp-tag${tone ? ' kp-tag--' + tone : ''}`} style={style}>
      {icon}
      {children}
      {closable && (
        <span className="kp-tag-x" onClick={onClose}>
          ×
        </span>
      )}
    </span>
  );
}
