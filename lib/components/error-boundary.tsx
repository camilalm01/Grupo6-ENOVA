"use client";

/**
 * ENOVA - Error Boundary Components
 *
 * Provides graceful degradation when microservices fail.
 * Each service has its own error boundary to prevent cascading failures.
 */

import { Component, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY CLASS
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  service?: "community" | "chat" | "auth" | "general";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[${this.props.service || "general"}] Error:`,
      error,
      errorInfo,
    );
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          service={this.props.service || "general"}
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR FALLBACK COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorFallbackProps {
  service: "community" | "chat" | "auth" | "general";
  error: Error | null;
  onRetry?: () => void;
}

const serviceMessages = {
  community: {
    title: "Feed temporalmente no disponible",
    message:
      "No pudimos cargar las publicaciones. El resto de la aplicación sigue funcionando.",
    icon: "📰",
  },
  chat: {
    title: "Chat temporalmente no disponible",
    message: "No pudimos conectar al chat. Intenta de nuevo en unos momentos.",
    icon: "💬",
  },
  auth: {
    title: "Error de autenticación",
    message:
      "Hubo un problema con tu sesión. Por favor, inicia sesión de nuevo.",
    icon: "🔐",
  },
  general: {
    title: "Algo salió mal",
    message:
      "Ocurrió un error inesperado. Estamos trabajando para solucionarlo.",
    icon: "⚠️",
  },
};

export function ErrorFallback({ service, error, onRetry }: ErrorFallbackProps) {
  const { title, message, icon } = serviceMessages[service];

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[200px] bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-purple-900 mb-2">{title}</h3>
      <p className="text-purple-700 text-center max-w-md mb-4">{message}</p>

      {process.env.NODE_ENV === "development" && error && (
        <details className="mb-4 max-w-lg">
          <summary className="text-sm text-purple-500 cursor-pointer hover:text-purple-700">
            Ver detalles técnicos
          </summary>
          <pre className="mt-2 p-3 bg-purple-900 text-purple-100 rounded-lg text-xs overflow-auto max-h-32">
            {error.message}
            {"\n"}
            {error.stack}
          </pre>
        </details>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
        >
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE-SPECIFIC ERROR BOUNDARIES
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error boundary for Community/Feed components
 * Shows friendly message but allows other services to work
 */
export function CommunityErrorBoundary({
  children,
  fallback,
  onError,
}: ServiceErrorBoundaryProps) {
  return (
    <ErrorBoundary service="community" fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for Chat components
 */
export function ChatErrorBoundary({
  children,
  fallback,
  onError,
}: ServiceErrorBoundaryProps) {
  return (
    <ErrorBoundary service="chat" fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for Auth components
 */
export function AuthErrorBoundary({
  children,
  fallback,
  onError,
}: ServiceErrorBoundaryProps) {
  return (
    <ErrorBoundary service="auth" fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE ERROR DISPLAY (for non-fatal errors)
// ═══════════════════════════════════════════════════════════════════════════════

interface InlineErrorProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  variant?: "error" | "warning" | "info";
}

export function InlineError({
  message,
  onDismiss,
  onRetry,
  variant = "error",
}: InlineErrorProps) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-purple-50 border-purple-200 text-purple-800",
  };

  const icons = {
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border ${styles[variant]}`}
    >
      <span className="text-lg">{icons[variant]}</span>
      <p className="flex-1 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium underline hover:no-underline"
        >
          Reintentar
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-black/5 rounded-full transition-colors"
          aria-label="Cerrar"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface ConnectionStatusProps {
  status:
    | "connected"
    | "connecting"
    | "reconnecting"
    | "disconnected"
    | "error";
  className?: string;
}

export function ConnectionStatus({
  status,
  className = "",
}: ConnectionStatusProps) {
  const statusConfig = {
    connected: { color: "bg-green-500", text: "Conectada", pulse: false },
    connecting: { color: "bg-yellow-500", text: "Conectando...", pulse: true },
    reconnecting: {
      color: "bg-yellow-500",
      text: "Reconectando...",
      pulse: true,
    },
    disconnected: { color: "bg-gray-400", text: "Desconectada", pulse: false },
    error: { color: "bg-red-500", text: "Error de conexión", pulse: false },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className={`relative w-2 h-2 rounded-full ${config.color}`}>
        {config.pulse && (
          <span
            className={`absolute inset-0 rounded-full ${config.color} animate-ping`}
          />
        )}
      </span>
      <span className="text-gray-600">{config.text}</span>
    </div>
  );
}

export default ErrorBoundary;
