/**
 * Notifications — short-lived celebratory/informational toasts.
 *
 * Used for:
 *  - Crypto Arena battle resolutions ("🎉 You won 200 CUTE$ on BTC Up!")
 *  - Fight Club run milestones (cashout tier, streak unlocks)
 *  - Any place we want to surface something good (or bad) outside the page flow
 *
 * Toasts auto-dismiss after `durationMs` (default 6s) unless `sticky: true`.
 */

import { create } from "zustand";

export type NotifTone = "win" | "loss" | "info" | "warning";

export interface Notification {
  id: string;
  tone: NotifTone;
  icon: string;
  title: string;
  body?: string;
  /** Optional link target — e.g. /battle/:id for "view the battle" */
  href?: string;
  /** ms before auto-dismiss. Default 6000. Set null to make sticky. */
  durationMs?: number | null;
  createdAt: number;
}

interface NotifState {
  list: Notification[];
  push: (n: Omit<Notification, "id" | "createdAt"> & { id?: string }) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

let _counter = 0;

export const useNotifications = create<NotifState>((set, get) => ({
  list: [],
  push: (n) => {
    _counter++;
    const id = n.id ?? `notif-${Date.now()}-${_counter}`;
    set(state => ({ list: [...state.list, { ...n, id, createdAt: Date.now() }] }));
    // Auto-dismiss
    const duration = n.durationMs === null ? null : (n.durationMs ?? 6000);
    if (duration !== null) {
      setTimeout(() => {
        if (get().list.some(x => x.id === id)) get().dismiss(id);
      }, duration);
    }
  },
  dismiss: (id) => set(state => ({ list: state.list.filter(n => n.id !== id) })),
  clear: () => set({ list: [] }),
}));
