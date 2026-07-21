import { Tag } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

/** Default color for each known video status (mirrors the former VideoTable statusColorMap). */
export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  new: 'green',
  needs_review: 'red',
  pending: 'gold',
  processing: 'blue',
  ready: 'purple',
  completed: 'default',
  error: 'error',
};

export interface StatusBadgeProps {
  status: string | null | undefined;
  /** Override the built-in status→color map. */
  colorMap?: Record<string, string>;
  /** Color used when the status is not in the map (default "default"). */
  fallbackColor?: string;
  /** Override the rendered label (defaults to the raw status). */
  label?: ReactNode;
  style?: CSSProperties;
}

/**
 * Presentational status tag: maps a status string to an antd Tag color. Renders nothing for an
 * empty/nullish status (so it drops cleanly into optional table cells).
 */
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
      {label ?? status}
    </Tag>
  );
}
