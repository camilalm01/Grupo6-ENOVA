/**
 * API Client for ENOVA Frontend
 *
 * All HTTP communication goes through the API Gateway.
 * This client handles authentication, token refresh, and error handling.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase client for auth only
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    status: number;
}

/**
 * Get the current access token from Supabase session
 */
export async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<boolean> {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
        console.error("Failed to refresh session:", error);
        return false;
    }
    return !!data.session;
}

/**
 * Fetch with authentication and automatic token refresh
 */
export async function fetchWithAuth<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
): Promise<ApiResponse<T>> {
    const { skipAuth = false, ...fetchOptions } = options;

    // Get token if auth is required
    let token: string | null = null;
    if (!skipAuth) {
        token = await getAccessToken();
        if (!token) {
            return {
                data: null,
                error: "No authentication token available",
                status: 401,
            };
        }
    }

    // Build headers
    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
    };

    if (token) {
        (headers as Record<string, string>)["Authorization"] =
            `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...fetchOptions,
            headers,
        });

        // Handle 401 with token refresh
        if (response.status === 401 && !skipAuth) {
            const refreshed = await refreshSession();
            if (refreshed) {
                // Retry with new token
                const newToken = await getAccessToken();
                if (newToken) {
                    (headers as Record<string, string>)["Authorization"] =
                        `Bearer ${newToken}`;
                    const retryResponse = await fetch(`${API_URL}${endpoint}`, {
                        ...fetchOptions,
                        headers,
                    });

                    const data = await retryResponse.json().catch(() => null);
                    return {
                        data,
                        error: retryResponse.ok
                            ? null
                            : data?.message || "Request failed",
                        status: retryResponse.status,
                    };
                }
            }

            // Refresh failed - redirect to login
            if (typeof window !== "undefined") {
                window.location.href = "/login";
            }
            return { data: null, error: "Session expired", status: 401 };
        }

        const data = await response.json().catch(() => null);

        return {
            data: response.ok ? data : null,
            error: response.ok
                ? null
                : (data?.message ||
                    `Request failed with status ${response.status}`),
            status: response.status,
        };
    } catch (error) {
        console.error("API request failed:", error);
        return {
            data: null,
            error: (error as Error).message || "Network error",
            status: 0,
        };
    }
}

// ═══════════════════════════════════════════════════════════
// API Methods
// ═══════════════════════════════════════════════════════════

/**
 * User Profile
 */
export const profile = {
    getMe: () => fetchWithAuth("/profile/me"),
    update: (data: Record<string, unknown>) =>
        fetchWithAuth("/profile/me", {
            method: "POST",
            body: JSON.stringify(data),
        }),
    getById: (userId: string) => fetchWithAuth(`/profile/${userId}`),
};

/**
 * Posts (Community)
 */
export const posts = {
    getAll: (limit = 20) => fetchWithAuth(`/posts?limit=${limit}`),
    getById: (postId: string) => fetchWithAuth(`/posts/${postId}`),
    create: (data: { content: string; category?: string }) =>
        fetchWithAuth("/posts", { method: "POST", body: JSON.stringify(data) }),
};

/**
 * Dashboard
 */
export const dashboard = {
    get: () => fetchWithAuth("/dashboard"),
};

/**
 * Health check (public)
 */
export const health = {
    check: () => fetchWithAuth("/health", { skipAuth: true }),
    circuits: () => fetchWithAuth("/circuits/status", { skipAuth: true }),
};

/**
 * Account
 */
export const account = {
    delete: () => fetchWithAuth("/account", { method: "DELETE" }),
};

// Default export
const apiClient = {
    profile,
    posts,
    dashboard,
    health,
    account,
    fetchWithAuth,
    getAccessToken,
    refreshSession,
};

export default apiClient;
