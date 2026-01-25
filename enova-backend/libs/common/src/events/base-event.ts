/**
 * Base Event Interface
 * Todas las eventos del sistema deben implementar esta interfaz
 * para garantizar trazabilidad e idempotencia.
 */
export interface BaseEvent<T = unknown> {
    /** ID único del evento (UUID v4) */
    eventId: string;

    /** Tipo del evento (ej: 'user.deleted', 'post.created') */
    eventType: string;

    /** Timestamp ISO de cuando se creó el evento */
    timestamp: string;

    /** Payload específico del evento */
    payload: T;

    /** Metadatos para tracing y control */
    metadata: EventMetadata;
}

export interface EventMetadata {
    /** ID de correlación para tracing distribuido */
    correlationId: string;

    /** Número de reintentos (0 = primer intento) */
    retryCount: number;

    /** Servicio que originó el evento */
    sourceService: string;

    /** Versión del schema del evento */
    schemaVersion: string;
}

/**
 * Resultado del procesamiento de un evento
 */
export interface EventProcessingResult {
    success: boolean;
    eventId: string;
    processedAt: string;
    error?: string;
}

/**
 * Helper para crear un nuevo evento
 */
import { v4 as uuidv4 } from "uuid";

export function createEvent<T>(
    eventType: string,
    payload: T,
    sourceService: string,
    correlationId?: string,
): BaseEvent<T> {
    return {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        payload,
        metadata: {
            correlationId: correlationId || uuidv4(),
            retryCount: 0,
            sourceService,
            schemaVersion: "1.0.0",
        },
    };
}
