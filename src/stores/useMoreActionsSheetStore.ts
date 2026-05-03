import { create } from 'zustand';

type MoreActionsSheetStore = {
  isOpen: boolean;
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
};

export const useMoreActionsSheetStore = create<MoreActionsSheetStore>((set) => ({
  isOpen: false,
  productId: null,
  open: (productId) => set({ isOpen: true, productId }),
  close: () => set({ isOpen: false, productId: null }),
}));
