import { create } from 'zustand';

type ProductSheetStore = {
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
};

export const useProductSheetStore = create<ProductSheetStore>((set) => ({
  productId: null,
  open: (productId) => set({ productId }),
  close: () => set({ productId: null }),
}));
