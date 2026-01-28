"use client";

/**
 * ENOVA - Client Providers
 *
 * Wraps the application with all necessary providers:
 * - TanStack Query for data fetching
 * - Error boundaries for resilience
 */

import { type ReactNode } from "react";
import { QueryProvider } from "@/lib/providers/query-provider";
import { ErrorBoundary } from "@/lib/components/error-boundary";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary service="general">
      <QueryProvider>{children}</QueryProvider>
    </ErrorBoundary>
  );
}

export default Providers;
