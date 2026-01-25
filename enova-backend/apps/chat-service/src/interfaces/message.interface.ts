export interface MessageData {
    userId: string;
    message: string;
    roomId: string;
    username?: string;
    clientMessageId?: string;
}

export interface ChatMessage {
    id: string;
    user_id: string;
    content: string;
    room_id: string;
    username: string | null;
    created_at: string;
    read_at?: string | null;
    deleted_at?: string | null;
}

export interface EnrichedMessage {
    id: string;
    userId: string;
    username: string;
    message: string;
    roomId: string;
    timestamp: string;
    socketId: string;
    clientMessageId?: string;
}

export interface UserJoinedEvent {
    userId: string;
    message: string;
    timestamp: string;
}

export interface UserLeftEvent {
    userId: string;
    message: string;
    timestamp: string;
}

export interface UserTypingEvent {
    userId: string;
    username: string;
    isTyping: boolean;
}
