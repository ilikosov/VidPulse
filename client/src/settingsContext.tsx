import { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, saveSetting } from './api';

type GroupType = 'male' | 'female' | 'mixed';

const SettingsContext = createContext<{ visibleGroupTypes: GroupType[]; setVisibleGroupTypes: (types: GroupType[]) => Promise<void>; }>({ visibleGroupTypes: ['female', 'mixed'], setVisibleGroupTypes: async () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [visibleGroupTypes, setState] = useState<GroupType[]>(['female', 'mixed']);
  useEffect(() => { getSettings().then((s) => setState((s.visible_group_types || 'female,mixed').split(',') as GroupType[])).catch(() => undefined); }, []);
  const setVisibleGroupTypes = async (types: GroupType[]) => {
    setState(types);
    await saveSetting('visible_group_types', types.join(','));
  };
  return <SettingsContext.Provider value={{ visibleGroupTypes, setVisibleGroupTypes }}>{children}</SettingsContext.Provider>;
}

export function useSettings() { return useContext(SettingsContext); }
