import { create } from 'zustand';

export type MainTabId = 'pour-toi' | 'marketplace';

type Store = {
  mainTab: MainTabId;
  setMainTab: (tab: MainTabId) => void;
};

export const useMainTabStore = create<Store>((set) => ({
  mainTab: 'pour-toi',
  setMainTab: (mainTab) => set({ mainTab }),
}));
