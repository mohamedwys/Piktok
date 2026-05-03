import { create } from 'zustand';

type LocationSheetStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const useLocationSheetStore = create<LocationSheetStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
