import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { from, Observable, of } from "rxjs";
import { catchError, timeout } from "rxjs/operators";
import { CircuitBreakerService } from "../services/circuit-breaker.service";
import {
    CIRCUIT_BREAKER_KEY,
    CircuitBreakerDecoratorOptions,
} from "../decorators/circuit-breaker.decorator";

/**
 * Interceptor que aplica Circuit Breaker a métodos decorados con @CircuitBreaker()
 */
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
    private readonly logger = new Logger(CircuitBreakerInterceptor.name);

    constructor(
        private reflector: Reflector,
        private circuitBreakerService: CircuitBreakerService,
    ) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        const options = this.reflector.get<CircuitBreakerDecoratorOptions>(
            CIRCUIT_BREAKER_KEY,
            context.getHandler(),
        );

        // Si no hay decorador, continuar normalmente
        if (!options) {
            return next.handle();
        }

        const { name, fallbackMethod, fallbackValue, timeout: timeoutMs } =
            options;
        const controller = context.getClass();
        const instance = context.switchToHttp().getRequest()?.["controller"] ||
            {};

        this.logger.debug(`Circuit Breaker "${name}" interceptando llamada`);

        // Crear la función fallback
        const fallback = () => {
            if (
                fallbackMethod && typeof instance[fallbackMethod] === "function"
            ) {
                return instance[fallbackMethod]();
            }
            if (fallbackValue !== undefined) {
                return fallbackValue;
            }
            return {
                error: "Service temporarily unavailable",
                cached: true,
                timestamp: new Date().toISOString(),
            };
        };

        // Ejecutar con Circuit Breaker
        return from(
            this.circuitBreakerService.wrap(
                name,
                () => next.handle().toPromise(),
                fallback,
                { timeout: timeoutMs },
            ),
        ).pipe(
            catchError((error) => {
                this.logger.warn(
                    `Circuit ${name} error, usando fallback: ${error.message}`,
                );
                return of(fallback());
            }),
        );
    }
}
