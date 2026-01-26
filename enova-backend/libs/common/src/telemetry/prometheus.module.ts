import { DynamicModule, Logger, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  PrometheusModule as NestPrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from "@willsoto/nestjs-prometheus";
import { collectDefaultMetrics, Registry } from "prom-client";

/**
 * Prometheus Module Configuration Options
 */
export interface PrometheusModuleOptions {
  /**
   * Service name for labeling metrics
   */
  serviceName: string;

  /**
   * Whether this is an HTTP service (API Gateway) or TCP microservice
   * HTTP services serve metrics on the main app port
   * TCP services need a separate HTTP server for metrics
   */
  isHttpService?: boolean;

  /**
   * Port for the metrics server (only for TCP microservices)
   * Default: 9091
   */
  metricsPort?: number;

  /**
   * Path for metrics endpoint
   * Default: /metrics
   */
  metricsPath?: string;

  /**
   * Enable default Node.js metrics (CPU, memory, event loop, etc.)
   * Default: true
   */
  enableDefaultMetrics?: boolean;
}

/**
 * Metrics Provider Tokens
 */
export const METRICS = {
  // HTTP Metrics (RED Method)
  HTTP_REQUEST_DURATION: "http_request_duration_seconds",
  HTTP_REQUESTS_TOTAL: "http_requests_total",
  HTTP_REQUESTS_IN_FLIGHT: "http_requests_in_flight",

  // RPC/Message Metrics
  RPC_MESSAGE_DURATION: "rpc_message_duration_seconds",
  RPC_MESSAGES_TOTAL: "rpc_messages_total",
  RPC_MESSAGES_ERRORS: "rpc_messages_errors_total",

  // Business Metrics
  AUTH_EVENTS: "auth_events_total",
  CHAT_MESSAGES: "chat_messages_total",
  WEBSOCKET_CONNECTIONS: "websocket_connections_active",
  POSTS_CREATED: "posts_created_total",

  // Database Metrics
  DB_QUERY_DURATION: "database_query_duration_seconds",
  DB_CONNECTIONS_ACTIVE: "database_connections_active",

  // Cache Metrics
  CACHE_OPERATIONS: "cache_operations_total",
  CACHE_HIT_RATIO: "cache_hit_ratio",

  // Event Bus Metrics
  EVENT_BUS_MESSAGES: "event_bus_messages_total",
  EVENT_BUS_PROCESSING_DURATION: "event_bus_processing_duration_seconds",

  // Circuit Breaker Metrics
  CIRCUIT_BREAKER_STATE: "circuit_breaker_state",
  CIRCUIT_BREAKER_FAILURES: "circuit_breaker_failures_total",
};

/**
 * Prometheus Module for ENOVA Microservices
 *
 * Provides centralized metrics collection for:
 * - HTTP Request metrics (Rate, Errors, Duration - RED Method)
 * - RPC/TCP message metrics
 * - Runtime metrics (CPU, Memory, Event Loop Lag)
 * - Custom business metrics
 *
 * Usage:
 * - For HTTP services (API Gateway): Import normally, metrics served on /metrics
 * - For TCP services: Call startMetricsServer() in main.ts to expose metrics on port 9091
 */
@Module({})
export class PrometheusModule implements OnModuleInit {
  private static readonly logger = new Logger(PrometheusModule.name);
  private static registry: Registry;
  private static options: PrometheusModuleOptions;

  /**
   * Register the module with configuration
   */
  static forRoot(options: PrometheusModuleOptions): DynamicModule {
    PrometheusModule.options = {
      metricsPort: 9091,
      metricsPath: "/metrics",
      enableDefaultMetrics: true,
      isHttpService: false,
      ...options,
    };

    const providers = [
      // HTTP Request Duration Histogram
      makeHistogramProvider({
        name: METRICS.HTTP_REQUEST_DURATION,
        help: "Duration of HTTP requests in seconds (RED: Duration)",
        labelNames: ["method", "route", "status_code", "service"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      }),

      // HTTP Requests Total Counter
      makeCounterProvider({
        name: METRICS.HTTP_REQUESTS_TOTAL,
        help: "Total number of HTTP requests (RED: Rate)",
        labelNames: ["method", "route", "status_code", "service"],
      }),

      // HTTP Requests In-Flight Gauge
      makeGaugeProvider({
        name: METRICS.HTTP_REQUESTS_IN_FLIGHT,
        help: "Number of HTTP requests currently being processed",
        labelNames: ["service"],
      }),

      // RPC Message Duration Histogram
      makeHistogramProvider({
        name: METRICS.RPC_MESSAGE_DURATION,
        help: "Duration of RPC message processing in seconds",
        labelNames: ["pattern", "transport", "service"],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      }),

      // RPC Messages Total Counter
      makeCounterProvider({
        name: METRICS.RPC_MESSAGES_TOTAL,
        help: "Total number of RPC messages processed",
        labelNames: ["pattern", "transport", "status", "service"],
      }),

      // RPC Message Errors Counter
      makeCounterProvider({
        name: METRICS.RPC_MESSAGES_ERRORS,
        help: "Total number of RPC message errors (RED: Errors)",
        labelNames: ["pattern", "transport", "error_type", "service"],
      }),

      // Authentication Events Counter
      makeCounterProvider({
        name: METRICS.AUTH_EVENTS,
        help: "Authentication events (login, logout, refresh, register)",
        labelNames: ["event_type", "success", "service"],
      }),

      // Chat Messages Counter
      makeCounterProvider({
        name: METRICS.CHAT_MESSAGES,
        help: "Total chat messages sent/received",
        labelNames: ["room_id", "message_type", "service"],
      }),

      // WebSocket Connections Gauge
      makeGaugeProvider({
        name: METRICS.WEBSOCKET_CONNECTIONS,
        help: "Number of active WebSocket connections",
        labelNames: ["room", "service"],
      }),

      // Posts Created Counter
      makeCounterProvider({
        name: METRICS.POSTS_CREATED,
        help: "Total posts created in community",
        labelNames: ["post_type", "service"],
      }),

      // Database Query Duration Histogram
      makeHistogramProvider({
        name: METRICS.DB_QUERY_DURATION,
        help: "Duration of database queries in seconds",
        labelNames: ["operation", "table", "service"],
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      }),

      // Database Connections Gauge
      makeGaugeProvider({
        name: METRICS.DB_CONNECTIONS_ACTIVE,
        help: "Number of active database connections",
        labelNames: ["pool", "service"],
      }),

      // Cache Operations Counter
      makeCounterProvider({
        name: METRICS.CACHE_OPERATIONS,
        help: "Cache operations (hit, miss, set, delete)",
        labelNames: ["operation", "result", "service"],
      }),

      // Event Bus Messages Counter
      makeCounterProvider({
        name: METRICS.EVENT_BUS_MESSAGES,
        help: "Messages processed via event bus (RabbitMQ)",
        labelNames: ["event_type", "status", "queue", "service"],
      }),

      // Event Bus Processing Duration Histogram
      makeHistogramProvider({
        name: METRICS.EVENT_BUS_PROCESSING_DURATION,
        help: "Duration of event bus message processing in seconds",
        labelNames: ["event_type", "queue", "service"],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      }),

      // Circuit Breaker State Gauge
      makeGaugeProvider({
        name: METRICS.CIRCUIT_BREAKER_STATE,
        help: "Circuit breaker state (0=closed, 1=open, 2=half-open)",
        labelNames: ["target_service", "service"],
      }),

      // Circuit Breaker Failures Counter
      makeCounterProvider({
        name: METRICS.CIRCUIT_BREAKER_FAILURES,
        help: "Total circuit breaker failures",
        labelNames: ["target_service", "failure_type", "service"],
      }),
    ];

    // Configure NestJS Prometheus module
    const prometheusConfig = options.isHttpService
      ? {
          // HTTP services: serve metrics on the main app
          path: options.metricsPath || "/metrics",
          defaultMetrics: {
            enabled: options.enableDefaultMetrics ?? true,
            config: {
              labels: { service: options.serviceName },
            },
          },
        }
      : {
          // TCP services: don't configure controller, we'll serve separately
          path: null as unknown as string,
          defaultMetrics: {
            enabled: options.enableDefaultMetrics ?? true,
            config: {
              labels: { service: options.serviceName },
            },
          },
        };

    return {
      module: PrometheusModule,
      imports: [ConfigModule, NestPrometheusModule.register(prometheusConfig)],
      providers: [
        ...providers,
        {
          provide: "PROMETHEUS_OPTIONS",
          useValue: PrometheusModule.options,
        },
      ],
      exports: [NestPrometheusModule, ...providers, "PROMETHEUS_OPTIONS"],
      global: true,
    };
  }

  /**
   * Async version for configuration from ConfigService
   */
  static forRootAsync(options: {
    useFactory: (
      configService: ConfigService,
    ) => PrometheusModuleOptions | Promise<PrometheusModuleOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: PrometheusModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: "PROMETHEUS_OPTIONS_ASYNC",
          useFactory: options.useFactory,
          inject: options.inject || [ConfigService],
        },
      ],
      exports: ["PROMETHEUS_OPTIONS_ASYNC"],
      global: true,
    };
  }

  async onModuleInit() {
    PrometheusModule.logger.log(
      `Prometheus metrics initialized for service: ${PrometheusModule.options?.serviceName || "unknown"}`,
    );
  }

  /**
   * Get the Prometheus registry
   */
  static getRegistry(): Registry {
    if (!PrometheusModule.registry) {
      PrometheusModule.registry = new Registry();
      if (PrometheusModule.options?.enableDefaultMetrics !== false) {
        collectDefaultMetrics({
          register: PrometheusModule.registry,
          labels: {
            service: PrometheusModule.options?.serviceName || "unknown",
          },
        });
      }
    }
    return PrometheusModule.registry;
  }

  /**
   * Get current options
   */
  static getOptions(): PrometheusModuleOptions {
    return PrometheusModule.options;
  }
}
