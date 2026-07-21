import type { ReactNode, CSSProperties } from 'react';

function Layout({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', minHeight: '100vh', ...style }}>{children}</div>;
}
function Header({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <header className="kp-topbar" style={style}>
      {children}
    </header>
  );
}
function Sider({
  children,
  width = 248,
  style,
}: {
  children?: ReactNode;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <aside className="kp-sidebar" style={{ width, ...style }}>
      {children}
    </aside>
  );
}
function Content({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <main className="kp-content" style={style}>
      {children}
    </main>
  );
}

(Layout as any).Header = Header;
(Layout as any).Sider = Sider;
(Layout as any).Content = Content;
export { Layout };
