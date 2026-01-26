import { IoAdapter } from "@nestjs/platform-socket.io";
import { Server, ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { INestApplication } from "@nestjs/common";

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

    constructor(app: INestApplication) {
        super(app);
    }

    /**
     * Conectar a Redis para sincronización de múltiples instancias
     */
    async connectToRedis(
        host: string,
        port: number,
        password?: string,
    ): Promise<void> {
        try {
            const redisUrl = password
                ? `redis://:${password}@${host}:${port}`
                : `redis://${host}:${port}`;

            const pubClient = createClient({ url: redisUrl });
            const subClient = pubClient.duplicate();

            await Promise.all([pubClient.connect(), subClient.connect()]);

            this.adapterConstructor = createAdapter(pubClient, subClient);

            console.log(`✅ Redis Adapter conectado a ${host}:${port}`);
        } catch (error) {
            console.warn(
                `⚠️  No se pudo conectar a Redis: ${(error as Error).message}`,
            );
            console.warn(
                "   El Chat Service funcionará sin sincronización de instancias.",
            );
            this.adapterConstructor = null;
        }
    }

    createIOServer(port: number, options?: ServerOptions): Server {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(",") || [
                    "http://localhost:3000",
                ],
                credentials: true,
            },
            path: "/socket.io",
            pingTimeout: 60000,
            pingInterval: 25000,
            // Opciones adicionales para estabilidad
            transports: ["websocket", "polling"],
            allowEIO3: true,
        });

        // Aplicar Redis adapter solo si está disponible
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }

        return server;
    }
}
