"use client";

/**
 * ENOVA - Zustand Stores
 *
 * Global state management for UI state that doesn't belong in React Query.
 * Keep data fetching in React Query, use Zustand for UI state only.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ═══════════════════════════════════════════════════════════════════════════════
// UI STATE STORE
// ═══════════════════════════════════════════════════════════════════════════════

interface UIState {
  // Sidebar state
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Mobile navigation
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Modal management
  activeModal: string | null;
  modalData: Record<string, unknown>;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  isSidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  // Mobile menu
  isMobileMenuOpen: false,
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  // Modals
  activeModal: null,
  modalData: {},
  openModal: (modalId, data = {}) =>
    set({ activeModal: modalId, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: {} }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// USER PREFERENCES STORE (Persisted)
// ═══════════════════════════════════════════════════════════════════════════════

interface UserPreferences {
  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Notifications
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  toggleNotifications: () => void;
  toggleSound: () => void;

  // Chat preferences
  showTypingIndicators: boolean;
  showOnlineStatus: boolean;
  toggleTypingIndicators: () => void;
  toggleOnlineStatus: () => void;

  // Feed preferences
  feedCategory: string | null;
  setFeedCategory: (category: string | null) => void;

  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
}

export const usePreferencesStore = create<UserPreferences>()(
  persist(
    (set) => ({
      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Notifications
      notificationsEnabled: true,
      soundEnabled: true,
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      toggleSound: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),

      // Chat
      showTypingIndicators: true,
      showOnlineStatus: true,
      toggleTypingIndicators: () =>
        set((state) => ({ showTypingIndicators: !state.showTypingIndicators })),
      toggleOnlineStatus: () =>
        set((state) => ({ showOnlineStatus: !state.showOnlineStatus })),

      // Feed
      feedCategory: null,
      setFeedCategory: (category) => set({ feedCategory: category }),

      // Accessibility
      reducedMotion: false,
      highContrast: false,
      setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
      setHighContrast: (enabled) => set({ highContrast: enabled }),
    }),
    {
      name: "enova-preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        soundEnabled: state.soundEnabled,
        showTypingIndicators: state.showTypingIndicators,
        showOnlineStatus: state.showOnlineStatus,
        feedCategory: state.feedCategory,
        reducedMotion: state.reducedMotion,
        highContrast: state.highContrast,
      }),
    },
  ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION STATE STORE
// ═══════════════════════════════════════════════════════════════════════════════

interface ConnectionState {
  // API health
  isApiHealthy: boolean;
  lastApiCheck: number | null;
  setApiHealth: (healthy: boolean) => void;

  // WebSocket connection
  wsStatus:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "error";
  setWsStatus: (status: ConnectionState["wsStatus"]) => void;

  // Network status
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // Service-specific health
  services: {
    auth: boolean;
    community: boolean;
    chat: boolean;
  };
  setServiceHealth: (
    service: keyof ConnectionState["services"],
    healthy: boolean,
  ) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  // API health
  isApiHealthy: true,
  lastApiCheck: null,
  setApiHealth: (healthy) =>
    set({ isApiHealthy: healthy, lastApiCheck: Date.now() }),

  // WebSocket
  wsStatus: "disconnected",
  setWsStatus: (status) => set({ wsStatus: status }),

  // Network
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  setOnline: (online) => set({ isOnline: online }),

  // Services
  services: {
    auth: true,
    community: true,
    chat: true,
  },
  setServiceHealth: (service, healthy) =>
    set((state) => ({
      services: { ...state.services, [service]: healthy },
    })),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK STATUS LISTENER (Client-side only)
// ═══════════════════════════════════════════════════════════════════════════════

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    useConnectionStore.getState().setOnline(true);
  });

  window.addEventListener("offline", () => {
    useConnectionStore.getState().setOnline(false);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to show toast notifications
 */
export function useToast() {
  const { addToast, removeToast } = useUIStore();

  return {
    success: (message: string, duration = 4000) => {
      const id = addToast({
        type: "success",
        message,
        duration,
      }) as unknown as string;
      if (duration) setTimeout(() => removeToast(id), duration);
    },
    error: (message: string, duration = 6000) => {
      const id = addToast({
        type: "error",
        message,
        duration,
      }) as unknown as string;
      if (duration) setTimeout(() => removeToast(id), duration);
    },
    warning: (message: string, duration = 5000) => {
      const id = addToast({
        type: "warning",
        message,
        duration,
      }) as unknown as string;
      if (duration) setTimeout(() => removeToast(id), duration);
    },
    info: (message: string, duration = 4000) => {
      const id = addToast({
        type: "info",
        message,
        duration,
      }) as unknown as string;
      if (duration) setTimeout(() => removeToast(id), duration);
    },
  };
}
