/**
 * Interfaz base para todos los repositorios
 *
 * Abstrae la capa de persistencia para que la lógica de negocio
 * no dependa de la implementación específica de la base de datos.
 */
export interface IRepository<T, CreateDto, UpdateDto> {
    /**
     * Buscar por ID
     */
    findById(id: string): Promise<T | null>;

    /**
     * Buscar todos (con paginación)
     */
    findAll(options?: PaginationOptions): Promise<PaginatedResult<T>>;

    /**
     * Crear nuevo registro
     */
    create(data: CreateDto): Promise<T>;

    /**
     * Actualizar registro existente
     */
    update(id: string, data: UpdateDto): Promise<T>;

    /**
     * Soft delete
     */
    delete(id: string): Promise<void>;

    /**
     * Restaurar registro eliminado
     */
    restore?(id: string): Promise<T>;
}

/**
 * Opciones de paginación
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    filters?: Record<string, unknown>;
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

/**
 * Interfaz específica para repositorio de Posts
 */
export interface IPostRepository
    extends IRepository<Post, CreatePostDto, UpdatePostDto> {
    findByAuthor(
        authorId: string,
        options?: PaginationOptions,
    ): Promise<PaginatedResult<Post>>;
    findByCategory(
        categoryId: string,
        options?: PaginationOptions,
    ): Promise<PaginatedResult<Post>>;
    search(
        query: string,
        options?: PaginationOptions,
    ): Promise<PaginatedResult<Post>>;
    incrementLikes(postId: string): Promise<void>;
    decrementLikes(postId: string): Promise<void>;
}

/**
 * Interfaz específica para repositorio de Profiles
 */
export interface IProfileRepository
    extends IRepository<Profile, CreateProfileDto, UpdateProfileDto> {
    findByEmail(email: string): Promise<Profile | null>;
    markAsDeleted(userId: string): Promise<void>;
    getDeletedProfiles(): Promise<Profile[]>;
}

/**
 * Interfaz específica para repositorio de Messages
 */
export interface IMessageRepository
    extends IRepository<Message, CreateMessageDto, UpdateMessageDto> {
    findByRoom(
        roomId: string,
        options?: PaginationOptions,
    ): Promise<PaginatedResult<Message>>;
    findByUser(
        userId: string,
        options?: PaginationOptions,
    ): Promise<PaginatedResult<Message>>;
    anonymizeByUser(userId: string): Promise<number>;
    restoreByUser(userId: string): Promise<number>;
}

// Type placeholders (se definen en cada servicio)
interface Post {
    id: string;
    authorId: string;
    title: string;
    content: string;
}

interface Profile {
    id: string;
    email: string;
    displayName: string | null;
}

interface Message {
    id: string;
    roomId: string;
    userId: string;
    content: string;
}

interface CreatePostDto {
    title: string;
    content: string;
    authorId: string;
}

interface UpdatePostDto {
    title?: string;
    content?: string;
}

interface CreateProfileDto {
    email: string;
    displayName?: string;
}

interface UpdateProfileDto {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
}

interface CreateMessageDto {
    roomId: string;
    userId: string;
    content: string;
}

interface UpdateMessageDto {
    content?: string;
}
