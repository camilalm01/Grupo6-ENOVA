"use client";

/**
 * ENOVA - TanStack Query Provider
 *
 * Configures React Query with:
 * - Optimized defaults for real-time apps
 * - Stale time configuration per query type
 * - Error handling and retry logic
 * - DevTools in development
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on window focus for chat (we use websockets)
        refetchOnWindowFocus: false,

        // Keep data fresh for 5 minutes by default
        staleTime: 5 * 60 * 1000,

        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,

        // Retry failed requests 2 times
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),

        // Don't refetch on mount if data is fresh
        refetchOnMount: false,

        // Don't refetch on reconnect (websocket handles this)
        refetchOnReconnect: false,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
}

// Browser singleton
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is important for React Strict Mode
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Use state to ensure client is created once per component lifecycle
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY KEYS FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Centralized query keys for cache management
 */
export const queryKeys = {
  // Auth & Profile
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
    profile: () => [...queryKeys.auth.all, "profile"] as const,
  },

  // Community / Posts
  posts: {
    all: ["posts"] as const,
    lists: () => [...queryKeys.posts.all, "list"] as const,
    list: (filters: { category?: string; limit?: number }) =>
      [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.posts.details(), id] as const,
    comments: (postId: string) =>
      [...queryKeys.posts.detail(postId), "comments"] as const,
  },

  // Chat
  chat: {
    all: ["chat"] as const,
    rooms: () => [...queryKeys.chat.all, "rooms"] as const,
    room: (roomId: string) => [...queryKeys.chat.rooms(), roomId] as const,
    messages: (roomId: string) =>
      [...queryKeys.chat.room(roomId), "messages"] as const,
  },

  // Dashboard
  dashboard: {
    all: ["dashboard"] as const,
    summary: () => [...queryKeys.dashboard.all, "summary"] as const,
  },

  // Health
  health: {
    all: ["health"] as const,
    status: () => [...queryKeys.health.all, "status"] as const,
    circuits: () => [...queryKeys.health.all, "circuits"] as const,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STALE TIME PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stale time presets for different query types
 */
export const staleTime = {
  // Real-time data (websocket-backed) - always stale to prefer WS updates
  realtime: 0,

  // Frequently changing data
  short: 30 * 1000, // 30 seconds

  // Moderately changing data
  medium: 5 * 60 * 1000, // 5 minutes

  // Rarely changing data
  long: 30 * 60 * 1000, // 30 minutes

  // Static data
  forever: Infinity,
};

export default QueryProvider;
