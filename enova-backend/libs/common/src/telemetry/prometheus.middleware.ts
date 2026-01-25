import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { Counter, Histogram, Registry } from "prom-client";

/**
 * Prometheus Metrics Registry
 * Singleton para evitar re-registro de métricas
 */
export const metricsRegistry = new Registry();

/**
 * HTTP Request Duration Histogram
 */
const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code", "service"],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
});

/**
 * HTTP Request Counter
 */
const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code", "service"],
    registers: [metricsRegistry],
});

/**
 * HTTP Request In-Flight Gauge
 */
const httpRequestsInFlight = new Counter({
    name: "http_requests_in_flight",
    help: "Number of HTTP requests currently being processed",
    labelNames: ["service"],
    registers: [metricsRegistry],
});

/**
 * Error Counter
 */
const errorsTotal = new Counter({
    name: "errors_total",
    help: "Total number of errors",
    labelNames: ["type", "service"],
    registers: [metricsRegistry],
});

/**
 * Prometheus Metrics Middleware
 *
 * Recolecta métricas de latencia, tráfico y errores por endpoint.
 */
@Injectable()
export class PrometheusMiddleware implements NestMiddleware {
    private readonly logger = new Logger(PrometheusMiddleware.name);
    private readonly serviceName: string;

    constructor() {
        this.serviceName = process.env.OTEL_SERVICE_NAME || "enova-service";
    }

    use(req: Request, res: Response, next: NextFunction): void {
        const startTime = process.hrtime.bigint();
        const route = req.route?.path || req.path;

        // Track in-flight requests
        httpRequestsInFlight.inc({ service: this.serviceName });

        // Hook into response finish
        res.on("finish", () => {
            const endTime = process.hrtime.bigint();
            const durationSeconds = Number(endTime - startTime) / 1e9;

            const labels = {
                method: req.method,
                route,
                status_code: res.statusCode.toString(),
                service: this.serviceName,
            };

            // Record metrics
            httpRequestDuration.observe(labels, durationSeconds);
            httpRequestsTotal.inc(labels);

            // Track errors
            if (res.statusCode >= 400) {
                errorsTotal.inc({
                    type: res.statusCode >= 500
                        ? "server_error"
                        : "client_error",
                    service: this.serviceName,
                });
            }
        });

        next();
    }
}

/**
 * Métricas personalizadas para ENOVA
 */
export const enovaMetrics = {
    // WebSocket connections
    wsConnectionsActive: new Counter({
        name: "websocket_connections_active",
        help: "Number of active WebSocket connections",
        labelNames: ["room"],
        registers: [metricsRegistry],
    }),

    // Messages sent
    messagesSent: new Counter({
        name: "chat_messages_sent_total",
        help: "Total chat messages sent",
        labelNames: ["room_id"],
        registers: [metricsRegistry],
    }),

    // Posts created
    postsCreated: new Counter({
        name: "posts_created_total",
        help: "Total posts created",
        registers: [metricsRegistry],
    }),

    // Authentication events
    authEvents: new Counter({
        name: "auth_events_total",
        help: "Authentication events (login, logout, refresh)",
        labelNames: ["event_type", "success"],
        registers: [metricsRegistry],
    }),

    // Database query duration
    dbQueryDuration: new Histogram({
        name: "database_query_duration_seconds",
        help: "Duration of database queries",
        labelNames: ["operation", "table"],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
        registers: [metricsRegistry],
    }),

    // Cache hit/miss
    cacheOperations: new Counter({
        name: "cache_operations_total",
        help: "Cache operations",
        labelNames: ["operation", "result"],
        registers: [metricsRegistry],
    }),

    // Event bus messages
    eventBusMessages: new Counter({
        name: "event_bus_messages_total",
        help: "Messages processed via event bus",
        labelNames: ["event_type", "status"],
        registers: [metricsRegistry],
    }),
};

/**
 * Controller para exponer métricas en /metrics
 */
export async function getMetrics(): Promise<string> {
    return metricsRegistry.metrics();
}
