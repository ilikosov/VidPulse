import type { CSSProperties } from 'react';
export function Divider({ style }: { style?: CSSProperties }) {
  return <hr className="kp-divider" style={style} />;
}
