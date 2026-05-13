import { toast as showToast } from 'burnt';

export const toast = {
  success: (title: string, message?: string) =>
    showToast({ title, message, preset: 'done', haptic: 'success' }),
  error: (title: string, message?: string) =>
    showToast({ title, message, preset: 'error', haptic: 'error' }),
  info: (title: string, message?: string) =>
    showToast({ title, message, preset: 'none', haptic: 'none' }),
};
