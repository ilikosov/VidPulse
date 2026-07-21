import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export interface DrawerProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  placement?: 'right' | 'left' | 'bottom';
  width?: number | string;
  destroyOnClose?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  placement = 'right',
  children,
  footer,
}: DrawerProps) {
  if (!open) return null;
  const mod =
    placement === 'left' ? ' kp-drawer--left' : placement === 'bottom' ? ' kp-drawer--bottom' : '';
  return createPortal(
    <>
      <div className="kp-drawer-overlay" onClick={onClose} />
      <div className={`kp-drawer${mod}`} role="dialog" aria-modal="true">
        {placement === 'bottom' && <div className="kp-drawer-handle" />}
        <div className="kp-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kp-drawer-title">{title}</div>
          </div>
          <Button type="text" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="kp-drawer-body">{children}</div>
        {footer && <div className="kp-drawer-foot">{footer}</div>}
        <div className="kp-drawer-accent" />
      </div>
    </>,
    document.body,
  );
}
