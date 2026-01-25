import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, RedisClientType } from "redis";

/**
 * Servicio de Idempotencia
 *
 * Previene el procesamiento duplicado de eventos almacenando
 * los eventId procesados en Redis con TTL.
 */
@Injectable()
export class IdempotencyService implements OnModuleInit {
    private readonly logger = new Logger(IdempotencyService.name);
    private client: RedisClientType;
    private readonly keyPrefix = "idempotency:";
    private readonly defaultTTL = 60 * 60 * 24; // 24 horas

    constructor(private configService: ConfigService) {}

    async onModuleInit() {
        const host = this.configService.get<string>("REDIS_HOST") ||
            "localhost";
        const port = this.configService.get<number>("REDIS_PORT") || 6379;

        try {
            this.client = createClient({ url: `redis://${host}:${port}` });
            await this.client.connect();
            this.logger.log(
                `Conectado a Redis para idempotencia: ${host}:${port}`,
            );
        } catch (error) {
            this.logger.error(
                `Error conectando a Redis: ${(error as Error).message}`,
            );
            // Continuar sin Redis - los eventos podrían procesarse duplicados
        }
    }

    /**
     * Verifica si un evento ya fue procesado
     * @returns true si el evento ya existe (duplicado)
     */
    async isDuplicate(eventId: string): Promise<boolean> {
        if (!this.client?.isReady) {
            this.logger.warn(
                "Redis no disponible, asumiendo evento no duplicado",
            );
            return false;
        }

        try {
            const exists = await this.client.exists(
                `${this.keyPrefix}${eventId}`,
            );
            return exists === 1;
        } catch (error) {
            this.logger.error(
                `Error verificando duplicado: ${(error as Error).message}`,
            );
            return false;
        }
    }

    /**
     * Marca un evento como procesado
     */
    async markAsProcessed(
        eventId: string,
        ttl: number = this.defaultTTL,
    ): Promise<void> {
        if (!this.client?.isReady) {
            this.logger.warn("Redis no disponible, evento no marcado");
            return;
        }

        try {
            await this.client.setEx(
                `${this.keyPrefix}${eventId}`,
                ttl,
                JSON.stringify({
                    processedAt: new Date().toISOString(),
                }),
            );
            this.logger.debug(`Evento marcado como procesado: ${eventId}`);
        } catch (error) {
            this.logger.error(
                `Error marcando evento: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Verifica y marca en una sola operación atomica
     * @returns true si el evento puede ser procesado (no es duplicado)
     */
    async tryProcess(eventId: string): Promise<boolean> {
        if (!this.client?.isReady) {
            this.logger.warn("Redis no disponible, permitiendo procesamiento");
            return true;
        }

        try {
            // SET NX (set if not exists) + EX (with expiration)
            const result = await this.client.set(
                `${this.keyPrefix}${eventId}`,
                JSON.stringify({ processedAt: new Date().toISOString() }),
                {
                    NX: true, // Only set if not exists
                    EX: this.defaultTTL,
                },
            );

            // Si result es 'OK', el evento no existía y ahora está marcado
            const canProcess = result === "OK";

            if (!canProcess) {
                this.logger.debug(`Evento duplicado ignorado: ${eventId}`);
            }

            return canProcess;
        } catch (error) {
            this.logger.error(
                `Error en tryProcess: ${(error as Error).message}`,
            );
            return true; // En caso de error, permitir procesamiento
        }
    }

    /**
     * Elimina una marca de procesamiento (para compensación/rollback)
     */
    async removeProcessedMark(eventId: string): Promise<void> {
        if (!this.client?.isReady) return;

        try {
            await this.client.del(`${this.keyPrefix}${eventId}`);
            this.logger.debug(`Marca de evento eliminada: ${eventId}`);
        } catch (error) {
            this.logger.error(
                `Error eliminando marca: ${(error as Error).message}`,
            );
        }
    }
}
