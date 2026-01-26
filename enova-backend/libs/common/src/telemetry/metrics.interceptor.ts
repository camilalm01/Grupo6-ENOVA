import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { Counter, Histogram } from "prom-client";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { METRICS } from "./prometheus.module";

/**
 * Metrics Interceptor for HTTP requests
 *
 * Automatically collects RED metrics (Rate, Errors, Duration) for all HTTP endpoints.
 * Used by API Gateway and other HTTP-based services.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpMetricsInterceptor.name);
  private readonly serviceName: string;

  constructor(
    @InjectMetric(METRICS.HTTP_REQUEST_DURATION)
    private readonly requestDuration: Histogram<string>,
    @InjectMetric(METRICS.HTTP_REQUESTS_TOTAL)
    private readonly requestsTotal: Counter<string>,
  ) {
    this.serviceName = process.env.OTEL_SERVICE_NAME || "unknown-service";
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Skip metrics endpoint
    if (request.url === "/metrics") {
      return next.handle();
    }

    const method = request.method;
    const route =
      request.route?.path || request.url?.split("?")[0] || "unknown";
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = response.statusCode?.toString() || "200";

        const labels = {
          method,
          route,
          status_code: statusCode,
          service: this.serviceName,
        };

        this.requestDuration.observe(labels, duration);
        this.requestsTotal.inc(labels);
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = error.status?.toString() || "500";

        const labels = {
          method,
          route,
          status_code: statusCode,
          service: this.serviceName,
        };

        this.requestDuration.observe(labels, duration);
        this.requestsTotal.inc(labels);

        return throwError(() => error);
      }),
    );
  }
}

/**
 * Metrics Interceptor for RPC/TCP messages
 *
 * Automatically collects metrics for TCP microservice message handlers.
 * Used by Auth, Chat, and Community services.
 */
@Injectable()
export class RpcMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RpcMetricsInterceptor.name);
  private readonly serviceName: string;

  constructor(
    @InjectMetric(METRICS.RPC_MESSAGE_DURATION)
    private readonly messageDuration: Histogram<string>,
    @InjectMetric(METRICS.RPC_MESSAGES_TOTAL)
    private readonly messagesTotal: Counter<string>,
    @InjectMetric(METRICS.RPC_MESSAGES_ERRORS)
    private readonly messagesErrors: Counter<string>,
  ) {
    this.serviceName = process.env.OTEL_SERVICE_NAME || "unknown-service";
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();

    // Get the message pattern from the RPC context
    const pattern = this.extractPattern(context);
    const transport = this.detectTransport(context);

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;

        const labels = {
          pattern,
          transport,
          service: this.serviceName,
        };

        this.messageDuration.observe(labels, duration);
        this.messagesTotal.inc({ ...labels, status: "success" });
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;

        const labels = {
          pattern,
          transport,
          service: this.serviceName,
        };

        this.messageDuration.observe(labels, duration);
        this.messagesTotal.inc({ ...labels, status: "error" });
        this.messagesErrors.inc({
          ...labels,
          error_type: error.name || "UnknownError",
        });

        return throwError(() => error);
      }),
    );
  }

  private extractPattern(context: ExecutionContext): string {
    try {
      // Try to get the handler metadata
      const handler = context.getHandler();
      const pattern = Reflect.getMetadata("microservices:pattern", handler);
      if (pattern) {
        if (typeof pattern === "string") return pattern;
        if (Array.isArray(pattern) && pattern.length > 0) {
          return typeof pattern[0] === "string"
            ? pattern[0]
            : JSON.stringify(pattern[0]);
        }
      }
      return handler.name || "unknown";
    } catch {
      return "unknown";
    }
  }

  private detectTransport(context: ExecutionContext): string {
    try {
      const rpcContext = context.switchToRpc().getContext();
      if (rpcContext?.getPattern) {
        return "tcp";
      }
      if (rpcContext?.getMessage) {
        return "rmq";
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }
}

/**
 * WebSocket Metrics Interceptor
 *
 * Collects metrics for WebSocket connections and messages.
 * Used by Chat service.
 */
@Injectable()
export class WsMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(WsMetricsInterceptor.name);
  private readonly serviceName: string;

  constructor(
    @InjectMetric(METRICS.RPC_MESSAGE_DURATION)
    private readonly messageDuration: Histogram<string>,
    @InjectMetric(METRICS.RPC_MESSAGES_TOTAL)
    private readonly messagesTotal: Counter<string>,
  ) {
    this.serviceName = process.env.OTEL_SERVICE_NAME || "unknown-service";
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const pattern = context.getHandler().name || "ws_unknown";
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;

        this.messageDuration.observe(
          { pattern, transport: "websocket", service: this.serviceName },
          duration,
        );
        this.messagesTotal.inc({
          pattern,
          transport: "websocket",
          status: "success",
          service: this.serviceName,
        });
      }),
      catchError((error) => {
        this.messagesTotal.inc({
          pattern,
          transport: "websocket",
          status: "error",
          service: this.serviceName,
        });
        return throwError(() => error);
      }),
    );
  }
}
