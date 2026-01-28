/**
 * ENOVA - Unified HTTP Client for API Gateway
 *
 * Centralizes all HTTP communication through the API Gateway.
 * Features:
 * - Automatic JWT injection from Supabase session
 * - Token refresh on 401 errors
 * - Request/Response interceptors
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for resilience
 */

import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Supabase client for authentication
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiError | null;
  status: number;
  headers?: Headers;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
}

export interface RequestConfig extends Omit<RequestInit, "body"> {
  skipAuth?: boolean;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  body?: unknown;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER - Protects against cascading failures
// ═══════════════════════════════════════════════════════════════════════════════

const circuitBreakers = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_TIME = 30000; // 30 seconds

function getServiceFromEndpoint(endpoint: string): string {
  if (endpoint.startsWith("/auth")) return "auth";
  if (endpoint.startsWith("/chat") || endpoint.startsWith("/rooms"))
    return "chat";
  if (endpoint.startsWith("/posts") || endpoint.startsWith("/community"))
    return "community";
  return "gateway";
}

function isCircuitOpen(service: string): boolean {
  const circuit = circuitBreakers.get(service);
  if (!circuit) return false;

  if (circuit.isOpen && Date.now() - circuit.lastFailure > CIRCUIT_RESET_TIME) {
    // Half-open state - allow one request through
    circuit.isOpen = false;
    circuit.failures = 0;
    return false;
  }

  return circuit.isOpen;
}

function recordFailure(service: string): void {
  const circuit = circuitBreakers.get(service) || {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= CIRCUIT_THRESHOLD) {
    circuit.isOpen = true;
    console.warn(`🔴 Circuit breaker OPEN for service: ${service}`);
  }

  circuitBreakers.set(service, circuit);
}

function recordSuccess(service: string): void {
  const circuit = circuitBreakers.get(service);
  if (circuit) {
    circuit.failures = 0;
    circuit.isOpen = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      cachedToken = session.access_token;
      // JWT expiry is in seconds, convert to ms
      tokenExpiry = (session.expires_at || 0) * 1000;
      return cachedToken;
    }

    return null;
  } catch (error) {
    console.error("Failed to get access token:", error);
    return null;
  }
}

export async function refreshToken(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      cachedToken = null;
      tokenExpiry = 0;
      return false;
    }

    cachedToken = data.session.access_token;
    tokenExpiry = (data.session.expires_at || 0) * 1000;
    return true;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    cachedToken = null;
    tokenExpiry = 0;
    return false;
  }
}

export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

// Listen for auth state changes
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      clearTokenCache();
    } else if (session) {
      cachedToken = session.access_token;
      tokenExpiry = (session.expires_at || 0) * 1000;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function httpClient<T = unknown>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const {
    skipAuth = false,
    retries = 2,
    retryDelay = 1000,
    timeout = 30000,
    body,
    headers: customHeaders,
    ...fetchConfig
  } = config;

  const service = getServiceFromEndpoint(endpoint);

  // Check circuit breaker
  if (isCircuitOpen(service)) {
    return {
      data: null,
      error: {
        code: "CIRCUIT_OPEN",
        message: `El servicio ${service} está temporalmente no disponible. Por favor, intenta de nuevo en unos momentos.`,
        retryable: true,
      },
      status: 503,
    };
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-Version": "1.0.0",
    ...(customHeaders as Record<string, string>),
  };

  // Add auth token if required
  if (!skipAuth) {
    const token = await getAccessToken();
    if (!token) {
      return {
        data: null,
        error: {
          code: "NO_AUTH",
          message: "No hay sesión activa. Por favor, inicia sesión.",
          retryable: false,
        },
        status: 401,
      };
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError: ApiError | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchConfig,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 - Try refresh token once
      if (response.status === 401 && !skipAuth && attempt === 0) {
        const refreshed = await refreshToken();
        if (refreshed) {
          const newToken = await getAccessToken();
          if (newToken) {
            headers["Authorization"] = `Bearer ${newToken}`;
            attempt++;
            continue;
          }
        }

        // Refresh failed - redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }

        return {
          data: null,
          error: {
            code: "SESSION_EXPIRED",
            message:
              "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",
            retryable: false,
          },
          status: 401,
        };
      }

      // Parse response
      const responseData = await response.json().catch(() => null);

      if (response.ok) {
        recordSuccess(service);
        return {
          data: responseData as T,
          error: null,
          status: response.status,
          headers: response.headers,
        };
      }

      // Non-retryable client errors (4xx except 401, 429)
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        return {
          data: null,
          error: {
            code: `HTTP_${response.status}`,
            message:
              responseData?.message ||
              `Error en la solicitud (${response.status})`,
            details: responseData,
            retryable: false,
          },
          status: response.status,
        };
      }

      // Retryable errors (5xx, 429)
      lastError = {
        code: `HTTP_${response.status}`,
        message:
          responseData?.message || `Error del servidor (${response.status})`,
        details: responseData,
        retryable: true,
      };

      recordFailure(service);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        lastError = {
          code: "TIMEOUT",
          message: "La solicitud tardó demasiado. Por favor, intenta de nuevo.",
          retryable: true,
        };
      } else {
        lastError = {
          code: "NETWORK_ERROR",
          message: "Error de conexión. Verifica tu conexión a internet.",
          details: error,
          retryable: true,
        };
      }

      recordFailure(service);
    }

    // Exponential backoff before retry
    if (attempt < retries) {
      await sleep(retryDelay * Math.pow(2, attempt));
    }
    attempt++;
  }

  return {
    data: null,
    error: lastError || {
      code: "UNKNOWN",
      message: "Error desconocido",
      retryable: false,
    },
    status: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export const api = {
  get: <T = unknown>(endpoint: string, config?: RequestConfig) =>
    httpClient<T>(endpoint, { ...config, method: "GET" }),

  post: <T = unknown>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig,
  ) => httpClient<T>(endpoint, { ...config, method: "POST", body }),

  put: <T = unknown>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig,
  ) => httpClient<T>(endpoint, { ...config, method: "PUT", body }),

  patch: <T = unknown>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig,
  ) => httpClient<T>(endpoint, { ...config, method: "PATCH", body }),

  delete: <T = unknown>(endpoint: string, config?: RequestConfig) =>
    httpClient<T>(endpoint, { ...config, method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE-SPECIFIC CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    api.post("/auth/login", credentials, { skipAuth: true }),

  register: (data: { email: string; password: string; fullName?: string }) =>
    api.post("/auth/register", data, { skipAuth: true }),

  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }, { skipAuth: true }),

  resetPassword: (token: string, password: string) =>
    api.post("/auth/reset-password", { token, password }, { skipAuth: true }),

  logout: () => api.post("/auth/logout"),

  getProfile: () => api.get("/profile/me"),

  updateProfile: (data: Record<string, unknown>) =>
    api.post("/profile/me", data),
};

export const communityApi = {
  getPosts: (params?: {
    limit?: number;
    offset?: number;
    category?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    if (params?.category) searchParams.set("category", params.category);
    const query = searchParams.toString();
    return api.get(`/posts${query ? `?${query}` : ""}`);
  },

  getPost: (postId: string) => api.get(`/posts/${postId}`),

  createPost: (data: {
    content: string;
    category?: string;
    imageUrl?: string;
  }) => api.post("/posts", data),

  updatePost: (postId: string, data: { content?: string; category?: string }) =>
    api.patch(`/posts/${postId}`, data),

  deletePost: (postId: string) => api.delete(`/posts/${postId}`),

  likePost: (postId: string) => api.post(`/posts/${postId}/like`),

  unlikePost: (postId: string) => api.delete(`/posts/${postId}/like`),

  getComments: (postId: string) => api.get(`/posts/${postId}/comments`),

  addComment: (postId: string, content: string) =>
    api.post(`/posts/${postId}/comments`, { content }),
};

export const chatApi = {
  getRooms: () => api.get("/chat/rooms"),

  getRoom: (roomId: string) => api.get(`/chat/rooms/${roomId}`),

  createRoom: (data: {
    name: string;
    description?: string;
    isPrivate?: boolean;
  }) => api.post("/chat/rooms", data),

  getMessages: (
    roomId: string,
    params?: { limit?: number; before?: string },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.before) searchParams.set("before", params.before);
    const query = searchParams.toString();
    return api.get(`/chat/rooms/${roomId}/messages${query ? `?${query}` : ""}`);
  },
};

export const healthApi = {
  check: () => api.get("/health", { skipAuth: true }),
  ready: () => api.get("/health/ready", { skipAuth: true }),
  circuits: () => api.get("/circuits/status", { skipAuth: true }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { supabase };
export default api;
