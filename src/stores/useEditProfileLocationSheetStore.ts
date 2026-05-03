import { create } from 'zustand';

type EditProfileLocationSheetStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const useEditProfileLocationSheetStore = create<EditProfileLocationSheetStore>(
  (set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
  }),
);
