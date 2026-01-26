import * as express from "express";
import { Logger } from "@nestjs/common";
import { Registry, collectDefaultMetrics, register } from "prom-client";

/**
 * Standalone Metrics Server for TCP Microservices
 *
 * Since TCP microservices don't have an HTTP server by default,
 * this class creates a lightweight Express server solely for
 * exposing Prometheus metrics on a dedicated port.
 *
 * Usage in main.ts:
 * ```typescript
 * const metricsServer = new MetricsServer({
 *   serviceName: 'auth-service',
 *   port: 9091,
 * });
 * await metricsServer.start();
 * ```
 */
export interface MetricsServerOptions {
  /**
   * Service name for metric labels
   */
  serviceName: string;

  /**
   * Port to expose metrics on
   * @default 9091
   */
  port?: number;

  /**
   * Path for metrics endpoint
   * @default /metrics
   */
  path?: string;

  /**
   * Enable Node.js default metrics
   * @default true
   */
  enableDefaultMetrics?: boolean;

  /**
   * Custom Prometheus registry
   * If not provided, uses the default global registry
   */
  registry?: Registry;
}

export class MetricsServer {
  private readonly logger = new Logger(MetricsServer.name);
  private readonly app: express.Application;
  private readonly port: number;
  private readonly path: string;
  private readonly serviceName: string;
  private readonly registry: Registry;
  private server: any;

  constructor(options: MetricsServerOptions) {
    this.serviceName = options.serviceName;
    this.port = options.port || 9091;
    this.path = options.path || "/metrics";
    // Create a new registry for this metrics server to avoid collisions
    this.registry = options.registry || new Registry();

    this.app = express();

    // Enable default Node.js metrics
    if (options.enableDefaultMetrics !== false) {
      collectDefaultMetrics({
        register: this.registry,
        labels: { service: this.serviceName },
      });
    }

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint for the metrics server itself
    this.app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok", service: this.serviceName });
    });

    // Metrics endpoint
    this.app.get(this.path, async (req, res) => {
      try {
        res.set("Content-Type", this.registry.contentType);
        const metrics = await this.registry.metrics();
        res.end(metrics);
      } catch (error) {
        this.logger.error(`Error collecting metrics: ${error}`);
        res.status(500).end("Error collecting metrics");
      }
    });

    // Root endpoint with service info
    this.app.get("/", (req, res) => {
      res.json({
        service: this.serviceName,
        metricsPath: this.path,
        port: this.port,
      });
    });
  }

  /**
   * Start the metrics server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, "0.0.0.0", () => {
          this.logger.log(
            `📊 Metrics server started: http://0.0.0.0:${this.port}${this.path}`,
          );
          resolve();
        });

        this.server.on("error", (error: Error) => {
          this.logger.error(`Metrics server error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        this.logger.error(`Failed to start metrics server: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * Stop the metrics server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error?: Error) => {
          if (error) {
            this.logger.error(`Error stopping metrics server: ${error}`);
            reject(error);
          } else {
            this.logger.log("Metrics server stopped");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get the Express app (for testing or custom routes)
   */
  getApp(): express.Application {
    return this.app;
  }
}

/**
 * Helper function to start a metrics server with default configuration
 */
export async function startMetricsServer(
  serviceName: string,
  port: number = 9091,
): Promise<MetricsServer> {
  const server = new MetricsServer({
    serviceName,
    port,
    enableDefaultMetrics: true,
  });
  await server.start();
  return server;
}
