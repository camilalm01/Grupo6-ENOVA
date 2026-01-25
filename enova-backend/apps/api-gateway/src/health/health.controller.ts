import { Controller, Get } from "@nestjs/common";
import { Public } from "../guards/supabase-auth.guard";
import { CircuitBreakerService } from "../services/circuit-breaker.service";

/**
 * Health Controller
 *
 * Provides health check endpoints for Kubernetes probes.
 */
@Controller("health")
export class HealthController {
    constructor(private readonly circuitBreaker: CircuitBreakerService) {}

    /**
     * Liveness probe - is the service alive?
     * Returns 200 if the service is running.
     */
    @Public()
    @Get()
    getLiveness() {
        return {
            status: "ok",
            service: "api-gateway",
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Readiness probe - is the service ready to receive traffic?
     * Checks dependencies like circuit breakers.
     */
    @Public()
    @Get("ready")
    getReadiness() {
        const circuits = this.circuitBreaker.getAllStats();

        // Check if any circuit is open (service degraded)
        const hasOpenCircuit = Object.values(circuits).some(
            (circuit: any) => circuit?.state === "OPEN",
        );

        if (hasOpenCircuit) {
            return {
                status: "degraded",
                message: "Some circuits are open",
                circuits,
                timestamp: new Date().toISOString(),
            };
        }

        return {
            status: "ready",
            service: "api-gateway",
            circuits,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Startup probe - has the service finished starting?
     */
    @Public()
    @Get("startup")
    getStartup() {
        return {
            status: "started",
            service: "api-gateway",
            timestamp: new Date().toISOString(),
        };
    }
}
