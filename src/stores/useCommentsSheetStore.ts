import { create } from 'zustand';

type CommentsSheetStore = {
  isOpen: boolean;
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
};

export const useCommentsSheetStore = create<CommentsSheetStore>((set) => ({
  isOpen: false,
  productId: null,
  open: (productId) => set({ isOpen: true, productId }),
  close: () => set({ isOpen: false, productId: null }),
}));
