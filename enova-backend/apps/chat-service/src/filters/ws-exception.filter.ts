import { ArgumentsHost, Catch, Logger } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
    private readonly logger = new Logger(WsExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const client = host.switchToWs().getClient();

        let message = "Error interno del servidor";

        if (exception instanceof WsException) {
            message = exception.message;
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        this.logger.error(`WebSocket Error: ${message}`);

        // Enviar error al cliente
        client.emit("error", {
            message,
            timestamp: new Date().toISOString(),
        });
    }
}
