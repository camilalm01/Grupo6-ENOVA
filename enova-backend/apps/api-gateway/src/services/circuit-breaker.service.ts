import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as CircuitBreaker from "opossum";

/**
 * Estados del Circuit Breaker:
 * - CLOSED: Funcionando normalmente, todas las llamadas pasan
 * - OPEN: Servicio fallando, todas las llamadas van al fallback
 * - HALF-OPEN: Probando si el servicio se recuperó
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF-OPEN";

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    fallbacks: number;
    timeouts: number;
    cacheHits: number;
}

export interface CircuitBreakerOptions {
    /** Tiempo máximo de espera para una llamada (ms) */
    timeout?: number;
    /** Porcentaje de errores para abrir el circuito */
    errorThresholdPercentage?: number;
    /** Tiempo que el circuito permanece abierto antes de probar (ms) */
    resetTimeout?: number;
    /** Número de llamadas a considerar para el threshold */
    volumeThreshold?: number;
}

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
    private readonly logger = new Logger(CircuitBreakerService.name);
    private readonly breakers = new Map<string, CircuitBreaker>();
    private readonly defaultOptions: CircuitBreakerOptions;

    constructor(private configService: ConfigService) {
        this.defaultOptions = {
            timeout: this.configService.get<number>("CB_TIMEOUT") || 5000,
            errorThresholdPercentage:
                this.configService.get<number>("CB_ERROR_THRESHOLD") || 50,
            resetTimeout: this.configService.get<number>("CB_RESET_TIMEOUT") ||
                30000,
            volumeThreshold: 5,
        };
    }

    onModuleInit() {
        this.logger.log("CircuitBreakerService inicializado");
        this.logger.debug(
            `Configuración: timeout=${this.defaultOptions.timeout}ms, ` +
                `errorThreshold=${this.defaultOptions.errorThresholdPercentage}%, ` +
                `resetTimeout=${this.defaultOptions.resetTimeout}ms`,
        );
    }

    /**
     * Ejecuta una función protegida por Circuit Breaker
     *
     * @param name - Nombre único del circuito (ej: 'community-service')
     * @param fn - Función async a ejecutar
     * @param fallback - Función fallback cuando el circuito está abierto
     * @param options - Opciones personalizadas del circuito
     */
    async execute<T>(
        name: string,
        fn: () => Promise<T>,
        fallback: () => T | Promise<T>,
        options?: CircuitBreakerOptions,
    ): Promise<T> {
        const breaker = this.getOrCreate(name, options);

        try {
            const result = await breaker.fire() as T;
            return result;
        } catch (error) {
            this.logger.warn(
                `Circuit ${name} ejecutó fallback: ${(error as Error).message}`,
            );
            return fallback();
        }
    }

    /**
     * Obtiene o crea un Circuit Breaker para un servicio
     */
    private getOrCreate(
        name: string,
        options?: CircuitBreakerOptions,
    ): CircuitBreaker {
        if (this.breakers.has(name)) {
            return this.breakers.get(name)!;
        }

        const mergedOptions = { ...this.defaultOptions, ...options };

        // Crear un breaker con una función placeholder
        // La función real se pasará en cada llamada
        const breaker = new CircuitBreaker(async () => {}, {
            timeout: mergedOptions.timeout,
            errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
            resetTimeout: mergedOptions.resetTimeout,
            volumeThreshold: mergedOptions.volumeThreshold,
        });

        // Eventos de logging
        breaker.on("open", () => {
            this.logger.warn(`🔴 Circuit ${name} ABIERTO - usando fallback`);
        });

        breaker.on("halfOpen", () => {
            this.logger.log(
                `🟡 Circuit ${name} HALF-OPEN - probando recuperación`,
            );
        });

        breaker.on("close", () => {
            this.logger.log(`🟢 Circuit ${name} CERRADO - funcionando normal`);
        });

        breaker.on("fallback", () => {
            this.logger.debug(`Circuit ${name}: fallback ejecutado`);
        });

        breaker.on("timeout", () => {
            this.logger.warn(`Circuit ${name}: timeout alcanzado`);
        });

        this.breakers.set(name, breaker);
        this.logger.log(`Circuit Breaker creado para: ${name}`);

        return breaker;
    }

    /**
     * Ejecuta una función con Circuit Breaker (versión simplificada)
     * La función y fallback se pasan directamente
     */
    async wrap<T>(
        name: string,
        fn: () => Promise<T>,
        fallback: () => T | Promise<T>,
        options?: CircuitBreakerOptions,
    ): Promise<T> {
        const mergedOptions = { ...this.defaultOptions, ...options };

        const breaker = new CircuitBreaker(fn, {
            timeout: mergedOptions.timeout,
            errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
            resetTimeout: mergedOptions.resetTimeout,
            volumeThreshold: mergedOptions.volumeThreshold,
        });

        breaker.fallback(fallback);

        // Eventos
        breaker.on(
            "open",
            () => this.logger.warn(`🔴 Circuit ${name} ABIERTO`),
        );
        breaker.on(
            "close",
            () => this.logger.log(`🟢 Circuit ${name} CERRADO`),
        );

        try {
            return await breaker.fire() as T;
        } catch (error) {
            this.logger.error(
                `Circuit ${name} error: ${(error as Error).message}`,
            );
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de un Circuit Breaker
     */
    getStats(name: string): CircuitBreakerStats | null {
        const breaker = this.breakers.get(name);
        if (!breaker) return null;

        const stats = breaker.stats;
        return {
            state: breaker.opened
                ? "OPEN"
                : (breaker.halfOpen ? "HALF-OPEN" : "CLOSED"),
            failures: stats.failures,
            successes: stats.successes,
            fallbacks: stats.fallbacks,
            timeouts: stats.timeouts,
            cacheHits: stats.cacheHits,
        };
    }

    /**
     * Obtiene el estado de todos los Circuit Breakers
     */
    getAllStats(): Record<string, CircuitBreakerStats> {
        const result: Record<string, CircuitBreakerStats> = {};

        for (const [name] of this.breakers) {
            const stats = this.getStats(name);
            if (stats) {
                result[name] = stats;
            }
        }

        return result;
    }
}
