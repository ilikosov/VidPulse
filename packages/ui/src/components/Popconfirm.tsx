import { useState, type ReactNode } from 'react';
import { Button } from './Button';

export interface PopconfirmProps {
  title: ReactNode;
  description?: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okType?: 'primary' | 'danger' | 'default';
  okButtonProps?: { danger?: boolean; disabled?: boolean };
  cancelButtonProps?: { disabled?: boolean };
  icon?: ReactNode;
  placement?: string;
  disabled?: boolean;
  children: ReactNode;
  [key: string]: unknown;
}

export function Popconfirm({
  title,
  description,
  onConfirm,
  onCancel,
  okText = 'Да',
  cancelText = 'Отмена',
  okButtonProps,
  icon,
  disabled,
  children,
}: PopconfirmProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="kp-pop-wrap">
      <span onClick={() => !disabled && setOpen((o) => !o)}>{children}</span>
      {open && !disabled && (
        <div className="kp-pop-card">
          <div className="kp-pop-card-title">
            {icon ?? (
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
            )}
            <div>
              {title}
              {description && <div className="kp-txt-faint">{description}</div>}
            </div>
          </div>
          <div className="kp-pop-card-foot">
            <Button
              type="text"
              size="small"
              onClick={() => {
                setOpen(false);
                onCancel?.();
              }}
            >
              {cancelText}
            </Button>
            <Button
              danger={okButtonProps?.danger ?? true}
              type="primary"
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
