import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';

export interface DrawerChrome {
  width?: DrawerProps['width'];
  title?: ReactNode;
  placement?: DrawerProps['placement'];
}

export interface CreateDrawerProviderConfig<TPayload, TApi> {
  /** Shown in the "must be used within …" error, e.g. "VideoDrawerProvider". */
  displayName: string;
  /** Drawer chrome — static, or derived from the active payload. */
  chrome: DrawerChrome | ((payload: TPayload) => DrawerChrome);
  /** Build the context value consumers see from the low-level opener. */
  createApi: (open: (payload: TPayload, onClose?: () => void) => void) => TApi;
  /**
   * Render the drawer body for the active payload. `close` force-closes the drawer;
   * `onClose` is the per-open callback (bodies that report "changed" pass it through).
   */
  renderBody: (payload: TPayload, close: () => void, onClose?: () => void) => ReactNode;
}

export interface DrawerProvider<TApi> {
  Provider: (props: { children: ReactNode }) => JSX.Element;
  useDrawer: () => TApi;
}

/**
 * Factory for the recurring "context + antd Drawer + open/close" provider shell. A payload (or null
 * = closed) drives the drawer; `open(payload, onClose?)` opens it and remembers a per-open callback
 * that fires on close. The domain-specific body and context API are supplied via `renderBody`/
 * `createApi`, so app-side providers shrink to a thin config.
 */
export function createDrawerProvider<TPayload, TApi>(
  config: CreateDrawerProviderConfig<TPayload, TApi>,
): DrawerProvider<TApi> {
  const Context = createContext<TApi | null>(null);

  function useDrawer(): TApi {
    const ctx = useContext(Context);
    if (!ctx) throw new Error(`useDrawer must be used within a ${config.displayName}`);
    return ctx;
  }

  function Provider({ children }: { children: ReactNode }): JSX.Element {
    const [payload, setPayload] = useState<TPayload | null>(null);
    const [onCloseCb, setOnCloseCb] = useState<(() => void) | undefined>(undefined);

    const open = useCallback((next: TPayload, onClose?: () => void) => {
      setPayload(next);
      setOnCloseCb(() => onClose);
    }, []);

    const close = useCallback(() => {
      setPayload(null);
      onCloseCb?.();
      setOnCloseCb(undefined);
    }, [onCloseCb]);

    const api = useMemo(() => config.createApi(open), [open]);

    const chrome =
      payload != null && typeof config.chrome === 'function'
        ? config.chrome(payload)
        : typeof config.chrome === 'function'
          ? undefined
          : config.chrome;

    return (
      <Context.Provider value={api}>
        {children}
        <Drawer
          open={payload != null}
          onClose={close}
          destroyOnClose
          width={chrome?.width}
          title={chrome?.title}
          placement={chrome?.placement}
        >
          {payload != null ? config.renderBody(payload, close, onCloseCb) : null}
        </Drawer>
      </Context.Provider>
    );
  }

  return { Provider, useDrawer };
}
