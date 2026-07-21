import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export interface ModalProps {
  open?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  title?: ReactNode;
  okText?: string;
  cancelText?: string;
  children?: ReactNode;
  footer?: ReactNode | null;
}

export function Modal({
  open,
  onCancel,
  onOk,
  title,
  okText = 'OK',
  cancelText = 'Отмена',
  children,
  footer,
}: ModalProps) {
  if (!open) return null;
  return createPortal(
    <div className="kp-overlay" onClick={onCancel}>
      <div className="kp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kp-modal-head">
          <div style={{ flex: 1 }}>
            <div className="kp-modal-title">{title}</div>
          </div>
          <Button type="text" onClick={onCancel}>
            ✕
          </Button>
        </div>
        <div className="kp-modal-body">{children}</div>
        <div className="kp-modal-foot">
          {footer !== null &&
            (footer ?? (
              <>
                <Button onClick={onCancel}>{cancelText}</Button>
                <Button type="primary" onClick={onOk}>
                  {okText}
                </Button>
              </>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
