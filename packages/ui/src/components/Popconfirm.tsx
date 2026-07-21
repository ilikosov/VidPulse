import { useState, type ReactNode } from 'react';
import { Button } from './Button';

export interface PopconfirmProps {
  title: ReactNode;
  onConfirm?: () => void;
  okText?: string;
  cancelText?: string;
  children: ReactNode;
}

export function Popconfirm({
  title,
  onConfirm,
  okText = 'Удалить',
  cancelText = 'Отмена',
  children,
}: PopconfirmProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="kp-pop-wrap">
      <span onClick={() => setOpen((o) => !o)}>{children}</span>
      {open && (
        <div className="kp-pop-card">
          <div className="kp-pop-card-title">
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4 2 20h20L12 4Z" />
              <path d="M12 10v4M12 17h.01" />
            </svg>
            {title}
          </div>
          <div className="kp-pop-card-foot">
            <Button type="text" size="small" onClick={() => setOpen(false)}>
              {cancelText}
            </Button>
            <Button
              danger
              size="small"
              onClick={() => {
                setOpen(false);
                onConfirm?.();
              }}
            >
              {okText}
            </Button>
          </div>
        </div>
      )}
    </span>
  );
}
