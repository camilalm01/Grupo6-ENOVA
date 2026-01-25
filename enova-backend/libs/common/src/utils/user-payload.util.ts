/**
 * Headers internos para comunicación con microservicios
 */
export const INTERNAL_HEADERS = {
    USER_PAYLOAD: "x-user-payload",
    INTERNAL_KEY: "x-internal-key",
    REQUEST_ID: "x-request-id",
    ORIGINAL_IP: "x-original-ip",
    FORWARDED_FOR: "x-forwarded-for",
    AUTHORIZATION: "authorization",
} as const;

/**
 * Interface del payload de usuario normalizado (CamelCase)
 * Coincide con lo que genera el API Gateway
 */
export interface IUserPayload {
    id: string;
    email: string | null;
    role: string;
    displayName: string | null;
    avatarUrl: string | null;
    iat: number;
    exp: number;
}

/**
 * Helper para decodificar X-User-Payload en microservicios
 */
export function decodeUserPayload(encoded: string): IUserPayload | null {
    try {
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");
        return JSON.parse(decoded) as IUserPayload;
    } catch {
        return null;
    }
}

/**
 * Helper para codificar usuario para X-User-Payload
 */
export function encodeUserPayload(user: IUserPayload): string {
    const payload = JSON.stringify(user);
    return Buffer.from(payload).toString("base64");
}
