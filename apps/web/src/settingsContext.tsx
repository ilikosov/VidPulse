import { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, saveSetting } from './api';

type GroupType = 'male' | 'female' | 'mixed';

const DEFAULT_PAGE_SIZE = 20;

const SettingsContext = createContext<{
  visibleGroupTypes: GroupType[];
  setVisibleGroupTypes: (types: GroupType[]) => Promise<void>;
  pageSize: number;
}>({
  visibleGroupTypes: ['female', 'mixed'],
  setVisibleGroupTypes: async () => {},
  pageSize: DEFAULT_PAGE_SIZE,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [visibleGroupTypes, setState] = useState<GroupType[]>(['female', 'mixed']);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  useEffect(() => {
    getSettings()
      .then((s) => {
        setState((s.visible_group_types || 'female,mixed').split(',') as GroupType[]);
        const parsed = Number(s.page_size);
        if (Number.isInteger(parsed) && parsed > 0) setPageSize(parsed);
      })
      .catch(() => undefined);
  }, []);
  const setVisibleGroupTypes = async (types: GroupType[]) => {
    setState(types);
    await saveSetting('visible_group_types', types.join(','));
  };
  return (
    <SettingsContext.Provider value={{ visibleGroupTypes, setVisibleGroupTypes, pageSize }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
