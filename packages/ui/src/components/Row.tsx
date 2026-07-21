import { Children, type ReactNode, type CSSProperties } from 'react';
export function Row({
  gutter = 16,
  style,
  children,
}: {
  gutter?: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className="kp-row2" style={{ margin: `0 -${gutter / 2}px`, ...style }}>
      {Children.map(
        children,
        (c: any) =>
          c && (
            <div
              style={{
                padding: `0 ${gutter / 2}px`,
                flex: c.props?.span ? `0 0 ${(c.props.span / 24) * 100}%` : 1,
              }}
            >
              {c}
            </div>
          ),
      )}
    </div>
  );
}
