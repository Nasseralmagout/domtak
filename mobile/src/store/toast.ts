import { create } from 'zustand';

interface ToastState {
  message?: string;
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  message: undefined,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: undefined }),
}));

/** Show a short confirmation at the bottom of the screen, e.g. toast('Added to calendar'). */
export const toast = (message: string) => useToast.getState().show(message);
