import type { ReactNode } from 'react';

export interface AlertProps {
  type?: 'success' | 'info' | 'warning' | 'error';
  message: ReactNode;
  description?: ReactNode;
  showIcon?: boolean;
  icon?: ReactNode;
}

const ICONS: Record<string, string> = {
  success: 'M5 12.5l4.5 4.5L19 7',
  warning: 'M12 10v4M12 17h.01',
  error: 'M9.5 9.5l5 5M14.5 9.5l-5 5',
  info: 'M12 11v6M12 7.5h.01',
};

export function Alert({ type = 'info', message, description, icon }: AlertProps) {
  return (
    <div className={`kp-alert kp-alert--${type}`}>
      {icon ?? (
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d={ICONS[type]} />
        </svg>
      )}
      <div>
        <div className="kp-alert-title">{message}</div>
        {description && <div className="kp-alert-desc">{description}</div>}
      </div>
    </div>
  );
}
