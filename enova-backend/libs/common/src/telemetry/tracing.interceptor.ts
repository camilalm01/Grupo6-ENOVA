import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { TelemetryService } from "./telemetry.service";

/**
 * Tracing Interceptor
 *
 * Interceptor que crea spans automáticos para cada handler de NestJS.
 * Añade atributos como método HTTP, ruta, y duración.
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(TracingInterceptor.name);

    constructor(private readonly telemetry: TelemetryService) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler().name;
        const controller = context.getClass().name;

        const spanName = `${controller}.${handler}`;
        const startTime = Date.now();

        // Añadir trace ID a los headers de respuesta
        const response = context.switchToHttp().getResponse();
        const traceId = this.telemetry.getCurrentTraceId();
        if (traceId) {
            response.setHeader("X-Trace-ID", traceId);
        }

        // Añadir atributos al span
        this.telemetry.addSpanAttributes({
            "http.method": request.method,
            "http.route": request.route?.path || request.path,
            "http.user_agent": request.headers["user-agent"] || "unknown",
            "enova.handler": handler,
            "enova.controller": controller,
            "enova.user_id": request.user?.id || "anonymous",
        });

        return next.handle().pipe(
            tap({
                next: () => {
                    const duration = Date.now() - startTime;
                    this.telemetry.addSpanAttributes({
                        "http.status_code": response.statusCode,
                        "enova.duration_ms": duration,
                    });
                },
                error: (error) => {
                    const duration = Date.now() - startTime;
                    this.telemetry.addSpanAttributes({
                        "http.status_code": error.status || 500,
                        "error.message": error.message,
                        "error.type": error.constructor.name,
                        "enova.duration_ms": duration,
                    });
                },
            }),
        );
    }
}
