import type { CSSProperties, ReactNode } from 'react';
import { Tag } from './components/Tag';

/** Default color per known video status (kpop-kit tone names, not antd Tag colors). */
export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  new: 'magenta',
  needs_review: 'red',
  pending: 'gold',
  processing: 'geekblue',
  ready: 'purple',
  completed: 'green',
  error: 'error',
};

const DEFAULT_LABELS: Record<string, string> = {
  new: 'Новое',
  needs_review: 'На проверке',
  pending: 'В очереди',
  processing: 'Обработка',
  ready: 'Готово',
  completed: 'Завершено',
  error: 'Ошибка',
};

export interface StatusBadgeProps {
  status: string | null | undefined;
  colorMap?: Record<string, string>;
  fallbackColor?: string;
  label?: ReactNode;
  style?: CSSProperties;
}

/** Presentational status tag — same public API as the antd-era version, now on the custom Tag. */
export function StatusBadge({
  status,
  colorMap = DEFAULT_STATUS_COLORS,
  fallbackColor = 'default',
  label,
  style,
}: StatusBadgeProps) {
  if (status == null || status === '') return null;
  return (
    <Tag color={colorMap[status] ?? fallbackColor} style={style}>
      {label ?? DEFAULT_LABELS[status] ?? status}
    </Tag>
  );
}
