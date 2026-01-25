import { SetMetadata } from "@nestjs/common";

export const CIRCUIT_BREAKER_KEY = "circuit_breaker";

export interface CircuitBreakerDecoratorOptions {
    /** Nombre del circuito */
    name: string;
    /** Función fallback como string (nombre del método en el mismo controlador) */
    fallbackMethod?: string;
    /** Valor fallback estático */
    fallbackValue?: unknown;
    /** Timeout en ms */
    timeout?: number;
    /** Porcentaje de errores para abrir el circuito */
    errorThreshold?: number;
}

/**
 * Decorador para aplicar Circuit Breaker a un método
 *
 * @example
 * ```typescript
 * @CircuitBreaker({
 *   name: 'community-service',
 *   fallbackMethod: 'getPostsFallback'
 * })
 * async getPosts() { ... }
 *
 * getPostsFallback() {
 *   return { posts: [], cached: true };
 * }
 * ```
 */
export const CircuitBreaker = (options: CircuitBreakerDecoratorOptions) =>
    SetMetadata(CIRCUIT_BREAKER_KEY, options);
