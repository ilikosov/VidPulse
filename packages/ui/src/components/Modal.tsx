import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Button } from './Button';

export interface ModalProps {
  open?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  title?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  style?: CSSProperties;
  mask?: boolean;
  maskClosable?: boolean;
  centered?: boolean;
  closable?: boolean;
  confirmLoading?: boolean;
  okButtonProps?: { danger?: boolean; disabled?: boolean };
  cancelButtonProps?: { disabled?: boolean };
  className?: string;
  destroyOnClose?: boolean;
  [key: string]: unknown;
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
  width = 520,
  style,
  mask = true,
  maskClosable = true,
  closable = true,
  confirmLoading,
  okButtonProps,
  cancelButtonProps,
  className,
}: ModalProps) {
  if (!open) return null;
  return createPortal(
    <div
      className={mask ? 'kp-overlay' : 'kp-overlay kp-overlay--nomask'}
      onClick={maskClosable ? onCancel : undefined}
    >
      <div
        className={`kp-modal${className ? ' ' + className : ''}`}
        style={{ width, ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kp-modal-head">
          <div className="kp-modal-title" style={{ flex: 1 }}>
            {title}
          </div>
          {closable && (
            <Button type="text" onClick={onCancel}>
              ✕
            </Button>
          )}
        </div>
        <div className="kp-modal-body">{children}</div>
        {footer !== null && (
          <div className="kp-modal-foot">
            {footer ?? (
              <>
                <Button onClick={onCancel} disabled={cancelButtonProps?.disabled}>
                  {cancelText}
                </Button>
                <Button
                  type="primary"
                  danger={okButtonProps?.danger}
                  disabled={okButtonProps?.disabled}
                  loading={confirmLoading}
                  onClick={onOk}
                >
                  {okText}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmConfig {
  title?: ReactNode;
  content?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: { danger?: boolean };
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
  [key: string]: unknown;
}

function spawn(config: ConfirmConfig, singleButton: boolean) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const close = () => {
    root.unmount();
    div.remove();
  };
  function Dialog() {
    const [loading, setLoading] = useState(false);
    return (
      <Modal
        open
        title={config.title}
        onCancel={() => {
          config.onCancel?.();
          close();
        }}
        footer={
          <>
            {!singleButton && (
              <Button
                onClick={() => {
                  config.onCancel?.();
                  close();
                }}
              >
                {config.cancelText ?? 'Отмена'}
              </Button>
            )}
            <Button
              type="primary"
              danger={config.okButtonProps?.danger}
              loading={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await config.onOk?.();
                  close();
                } catch {
                  setLoading(false);
                }
              }}
            >
              {config.okText ?? 'OK'}
            </Button>
          </>
        }
      >
        {config.content}
      </Modal>
    );
  }
  root.render(<Dialog />);
  return { destroy: close };
}

const confirm = (config: ConfirmConfig) => spawn(config, false);
const info = (config: ConfirmConfig) => spawn(config, true);

(Modal as any).confirm = confirm;
(Modal as any).info = info;
(Modal as any).success = info;
(Modal as any).error = info;
(Modal as any).warning = info;
(Modal as any).useModal = () => [
  { confirm, info, success: info, error: info, warning: info },
  null,
];
