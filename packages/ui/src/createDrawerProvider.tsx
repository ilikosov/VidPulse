import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Drawer } from './components/Drawer';
import type { DrawerProps } from './components/Drawer';

export interface DrawerChrome {
  width?: DrawerProps['width'];
  title?: ReactNode;
  placement?: DrawerProps['placement'];
}

export interface CreateDrawerProviderConfig<TPayload, TApi> {
  displayName: string;
  chrome: DrawerChrome | ((payload: TPayload) => DrawerChrome);
  createApi: (open: (payload: TPayload, onClose?: () => void) => void) => TApi;
  renderBody: (payload: TPayload, close: () => void, onClose?: () => void) => ReactNode;
}

export interface DrawerProvider<TApi> {
  Provider: (props: { children: ReactNode }) => JSX.Element;
  useDrawer: () => TApi;
}

/** Same factory shape as the antd-era version — now backed by the custom Drawer, no antd import. */
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
