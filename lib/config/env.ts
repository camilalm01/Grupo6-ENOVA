/**
 * ENOVA - Environment Configuration
 *
 * Centralized environment variable access with validation and defaults.
 * This ensures type safety and catches missing variables early.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface EnvConfig {
  // API Gateway
  apiUrl: string;
  wsUrl: string;

  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;

  // Feature flags
  isDevelopment: boolean;
  isProduction: boolean;

  // Optional
  sentryDsn?: string;
  analyticsId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;

  if (!value && typeof window === "undefined") {
    console.warn(`⚠️ Environment variable ${key} is not set`);
  }

  return value || "";
}

function getRequiredEnvVar(key: string): string {
  const value = process.env[key];

  if (!value) {
    // In browser, some env vars might not be available
    if (typeof window !== "undefined") {
      console.warn(`Environment variable ${key} not available in browser`);
      return "";
    }

    // In server, throw for truly required vars in production
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Required environment variable ${key} is not set`);
    }

    console.warn(`⚠️ Required environment variable ${key} is not set`);
    return "";
  }

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION OBJECT
// ═══════════════════════════════════════════════════════════════════════════════

export const env: EnvConfig = {
  // API Gateway - all HTTP requests go through here
  apiUrl: getEnvVar("NEXT_PUBLIC_API_URL", "http://localhost:3000"),

  // WebSocket URL - can be same as API URL or separate
  wsUrl: getEnvVar(
    "NEXT_PUBLIC_WS_URL",
    getEnvVar("NEXT_PUBLIC_API_URL", "http://localhost:3000"),
  ),

  // Supabase - used for authentication
  supabaseUrl: getEnvVar(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://placeholder.supabase.co",
  ),
  supabaseAnonKey: getEnvVar(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "placeholder-key",
  ),

  // Environment flags
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",

  // Optional services
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID,
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION ON IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

// Only validate in development to catch issues early
if (env.isDevelopment && typeof window === "undefined") {
  const missingVars: string[] = [];

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === "https://placeholder.supabase.co"
  ) {
    missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "placeholder-key"
  ) {
    missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missingVars.length > 0) {
    console.warn(`
╔════════════════════════════════════════════════════════════════╗
║  ⚠️  ENOVA - Missing Environment Variables                      ║
╠════════════════════════════════════════════════════════════════╣
║  The following variables are not properly configured:          ║
${missingVars.map((v) => `║  • ${v.padEnd(55)}║`).join("\n")}
║                                                                ║
║  Please check your .env.local file.                            ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build full API URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  const base = env.apiUrl.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Check if running on server
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Check if running on client
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}

export default env;
