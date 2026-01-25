import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as opentelemetry from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
    context,
    propagation,
    SpanStatusCode,
    trace,
} from "@opentelemetry/api";

/**
 * OpenTelemetry Telemetry Service
 *
 * Inicializa y configura OpenTelemetry para tracing y métricas.
 * Envía datos a Jaeger/OTLP collector.
 */
@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TelemetryService.name);
    private sdk: opentelemetry.NodeSDK | null = null;
    private readonly serviceName: string;
    private readonly enabled: boolean;

    constructor(private readonly configService: ConfigService) {
        this.serviceName =
            this.configService.get<string>("OTEL_SERVICE_NAME") ||
            "enova-service";
        this.enabled =
            this.configService.get<boolean>("OTEL_ENABLED") !== false;
    }

    async onModuleInit() {
        if (!this.enabled) {
            this.logger.log("OpenTelemetry deshabilitado");
            return;
        }

        try {
            await this.initializeSdk();
            this.logger.log(
                `OpenTelemetry inicializado para: ${this.serviceName}`,
            );
        } catch (error) {
            this.logger.error(
                `Error inicializando OpenTelemetry: ${
                    (error as Error).message
                }`,
            );
        }
    }

    async onModuleDestroy() {
        if (this.sdk) {
            await this.sdk.shutdown();
            this.logger.log("OpenTelemetry apagado");
        }
    }

    private async initializeSdk() {
        const otlpEndpoint =
            this.configService.get<string>("OTEL_EXPORTER_OTLP_ENDPOINT") ||
            "http://localhost:4317";

        // Recurso que identifica el servicio
        const resource = new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
            [SemanticResourceAttributes.SERVICE_VERSION]:
                this.configService.get<string>("APP_VERSION") || "1.0.0",
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
                this.configService.get<string>("NODE_ENV") || "development",
        });

        // Exporters
        const traceExporter = new OTLPTraceExporter({ url: otlpEndpoint });
        const metricExporter = new OTLPMetricExporter({ url: otlpEndpoint });

        // SDK Config
        this.sdk = new opentelemetry.NodeSDK({
            resource,
            traceExporter,
            metricReader: new PeriodicExportingMetricReader({
                exporter: metricExporter,
                exportIntervalMillis: 30000,
            }) as any,
            spanProcessor: new BatchSpanProcessor(traceExporter, {
                maxQueueSize: 2048,
                maxExportBatchSize: 512,
                scheduledDelayMillis: 5000,
            }) as any,
            textMapPropagator: new W3CTraceContextPropagator(),
            instrumentations: [
                getNodeAutoInstrumentations({
                    "@opentelemetry/instrumentation-http": {
                        enabled: true,
                        ignoreIncomingPaths: [
                            "/health",
                            "/health/ready",
                            "/metrics",
                        ],
                    },
                    "@opentelemetry/instrumentation-express": { enabled: true },
                    "@opentelemetry/instrumentation-nestjs-core": {
                        enabled: true,
                    },
                    "@opentelemetry/instrumentation-pg": { enabled: true },
                    "@opentelemetry/instrumentation-redis": { enabled: true },
                }),
            ],
        });

        await this.sdk.start();
        propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    }

    /**
     * Obtiene el tracer para crear spans manuales
     */
    getTracer(name?: string) {
        return trace.getTracer(name || this.serviceName);
    }

    /**
     * Crea un span para una operación
     */
    startSpan(
        name: string,
        options?: { attributes?: Record<string, string | number | boolean> },
    ) {
        const tracer = this.getTracer();
        return tracer.startSpan(name, {
            attributes: options?.attributes,
        });
    }

    /**
     * Wrapper para ejecutar código dentro de un span
     */
    async withSpan<T>(
        name: string,
        fn: () => Promise<T>,
        options?: { attributes?: Record<string, string | number | boolean> },
    ): Promise<T> {
        const tracer = this.getTracer();
        const span = tracer.startSpan(name, {
            attributes: options?.attributes,
        });

        try {
            const result = await context.with(
                trace.setSpan(context.active(), span),
                fn,
            );
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: (error as Error).message,
            });
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Obtiene el trace ID actual para correlación de logs
     */
    getCurrentTraceId(): string | null {
        const span = trace.getActiveSpan();
        if (!span) return null;
        return span.spanContext().traceId;
    }

    /**
     * Añade atributos al span actual
     */
    addSpanAttributes(attributes: Record<string, string | number | boolean>) {
        const span = trace.getActiveSpan();
        if (span) {
            span.setAttributes(attributes);
        }
    }
}
