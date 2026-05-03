import { create } from 'zustand';

type LocationSessionStore = {
  firstLaunchPromptDismissedThisSession: boolean;
  dismissFirstLaunchPrompt: () => void;
  resetSession: () => void;
};

export const useLocationSession = create<LocationSessionStore>((set) => ({
  firstLaunchPromptDismissedThisSession: false,
  dismissFirstLaunchPrompt: () =>
    set({ firstLaunchPromptDismissedThisSession: true }),
  resetSession: () =>
    set({ firstLaunchPromptDismissedThisSession: false }),
}));
