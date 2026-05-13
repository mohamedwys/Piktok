import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

// Single MMKV instance for the app. The id namespaces the file on disk so
// future encrypted instances (e.g., per-user) can coexist.
const mmkv = createMMKV({ id: 'mony.v1' });

export const mmkvStorage: StateStorage = {
  getItem: (k) => mmkv.getString(k) ?? null,
  setItem: (k, v) => {
    mmkv.set(k, v);
  },
  removeItem: (k) => {
    mmkv.remove(k);
  },
};

// Synchronous accessors for non-zustand consumers (e.g., i18n).
export const mmkvSync = {
  getString: (k: string) => mmkv.getString(k) ?? null,
  setString: (k: string, v: string) => {
    mmkv.set(k, v);
  },
  delete: (k: string) => {
    mmkv.remove(k);
  },
};
