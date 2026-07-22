import type { ReactNode, CSSProperties } from 'react';

interface LayoutSlotProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
}

function LayoutBase({ children, style, className }: LayoutSlotProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', ...style }}
    >
      {children}
    </div>
  );
}
function Header({ children, style, className }: LayoutSlotProps) {
  return (
    <header className={`kp-topbar${className ? ' ' + className : ''}`} style={style}>
      {children}
    </header>
  );
}
function Sider({ children, style, className }: LayoutSlotProps & { width?: number }) {
  return (
    <aside className={`kp-sidebar${className ? ' ' + className : ''}`} style={style}>
      {children}
    </aside>
  );
}
function Content({ children, style, className }: LayoutSlotProps) {
  return (
    <main className={`kp-content${className ? ' ' + className : ''}`} style={style}>
      {children}
    </main>
  );
}
function Footer({ children, style, className }: LayoutSlotProps) {
  return (
    <footer className={className} style={style}>
      {children}
    </footer>
  );
}

export const Layout = Object.assign(LayoutBase, { Header, Sider, Content, Footer });
