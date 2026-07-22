import { Children, type ReactNode, type CSSProperties } from 'react';

export interface RowProps {
  gutter?: number | [number, number];
  align?: 'top' | 'middle' | 'bottom' | 'stretch';
  justify?: string;
  wrap?: boolean;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Row({
  gutter = 16,
  align,
  justify,
  wrap = true,
  style,
  className,
  children,
}: RowProps) {
  const g = Array.isArray(gutter) ? gutter[0] : gutter;
  const gv = Array.isArray(gutter) ? gutter[1] : 0;
  return (
    <div
      className={`kp-row2${className ? ' ' + className : ''}`}
      style={{
        margin: `0 -${g / 2}px`,
        rowGap: gv,
        alignItems:
          align === 'middle'
            ? 'center'
            : align === 'bottom'
              ? 'flex-end'
              : align === 'top'
                ? 'flex-start'
                : undefined,
        justifyContent: justify as any,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {Children.map(
        children,
        (c: any) =>
          c && (
            <div
              style={{
                padding: `0 ${g / 2}px`,
                flex: c.props?.span ? `0 0 ${(c.props.span / 24) * 100}%` : undefined,
              }}
            >
              {c}
            </div>
          ),
      )}
    </div>
  );
}
