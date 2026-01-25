import { BaseEvent, createEvent } from "./base-event";

/**
 * ═══════════════════════════════════════════════════════════
 * EVENTOS DE USUARIO
 * Definidos para el flujo Saga de eliminación de cuenta
 * ═══════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────────────────────

export interface UserDeletedPayload {
    userId: string;
    email: string;
    deletedAt: string;
    reason?: string;
}

export interface UserPostsDeletedPayload {
    userId: string;
    postCount: number;
    deletedAt: string;
}

export interface UserMessagesAnonymizedPayload {
    userId: string;
    messageCount: number;
    anonymizedAt: string;
}

export interface UserDeletionFailedPayload {
    userId: string;
    failedStep: "community" | "chat";
    reason: string;
    originalEvent: BaseEvent<UserDeletedPayload>;
}

export interface UserDeletionCompensatedPayload {
    userId: string;
    compensatedSteps: string[];
    compensatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Event Types (Constantes)
// ─────────────────────────────────────────────────────────────

export const USER_EVENTS = {
    USER_DELETED: "user.deleted",
    USER_POSTS_DELETED: "user.posts.deleted",
    USER_MESSAGES_ANONYMIZED: "user.messages.anonymized",
    USER_DELETION_FAILED: "user.deletion.failed",
    USER_DELETION_COMPENSATED: "user.deletion.compensated",
    USER_RESTORED: "user.restored",
} as const;

// ─────────────────────────────────────────────────────────────
// Event Types (TypeScript)
// ─────────────────────────────────────────────────────────────

export type UserDeletedEvent = BaseEvent<UserDeletedPayload>;
export type UserPostsDeletedEvent = BaseEvent<UserPostsDeletedPayload>;
export type UserMessagesAnonymizedEvent = BaseEvent<
    UserMessagesAnonymizedPayload
>;
export type UserDeletionFailedEvent = BaseEvent<UserDeletionFailedPayload>;
export type UserDeletionCompensatedEvent = BaseEvent<
    UserDeletionCompensatedPayload
>;

// ─────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────

export function createUserDeletedEvent(
    payload: UserDeletedPayload,
    correlationId?: string,
): UserDeletedEvent {
    return createEvent(
        USER_EVENTS.USER_DELETED,
        payload,
        "auth-service",
        correlationId,
    );
}

export function createUserPostsDeletedEvent(
    payload: UserPostsDeletedPayload,
    correlationId: string,
): UserPostsDeletedEvent {
    return createEvent(
        USER_EVENTS.USER_POSTS_DELETED,
        payload,
        "community-service",
        correlationId,
    );
}

export function createUserMessagesAnonymizedEvent(
    payload: UserMessagesAnonymizedPayload,
    correlationId: string,
): UserMessagesAnonymizedEvent {
    return createEvent(
        USER_EVENTS.USER_MESSAGES_ANONYMIZED,
        payload,
        "chat-service",
        correlationId,
    );
}

export function createUserDeletionFailedEvent(
    payload: UserDeletionFailedPayload,
    correlationId: string,
): UserDeletionFailedEvent {
    return createEvent(
        USER_EVENTS.USER_DELETION_FAILED,
        payload,
        payload.failedStep === "community"
            ? "community-service"
            : "chat-service",
        correlationId,
    );
}
