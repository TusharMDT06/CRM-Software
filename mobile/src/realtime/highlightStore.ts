import { create } from 'zustand';

interface HighlightState {
  highlightedIds: Record<string, number>;
  triggerHighlight: (id: string, durationMs?: number) => void;
  isHighlighted: (id: string) => boolean;
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlightedIds: {},

  triggerHighlight: (id: string, durationMs: number = 1200) => {
    if (!id) return;
    const expiresAt = Date.now() + durationMs;
    set((state) => ({
      highlightedIds: {
        ...state.highlightedIds,
        [id]: expiresAt,
      },
    }));

    setTimeout(() => {
      set((state) => {
        const next = { ...state.highlightedIds };
        delete next[id];
        return { highlightedIds: next };
      });
    }, durationMs);
  },

  isHighlighted: (id: string) => {
    const expires = get().highlightedIds[id];
    return Boolean(expires && expires > Date.now());
  },
}));

export function useIsRowHighlighted(id?: string): boolean {
  return useHighlightStore((state) => (id ? Boolean(state.highlightedIds[id]) : false));
}
