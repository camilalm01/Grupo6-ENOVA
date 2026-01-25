import { SetMetadata } from "@nestjs/common";

/**
 * Permisos granulares disponibles en ENOVA
 *
 * Formato: recurso:acción[:scope]
 * - scope puede ser 'own' o 'any'
 */
export type Permission =
    // Posts
    | "posts:create"
    | "posts:read:any"
    | "posts:update:own"
    | "posts:update:any"
    | "posts:delete:own"
    | "posts:delete:any"
    | "posts:pin"
    | "posts:flag"
    // Comments
    | "comments:create"
    | "comments:update:own"
    | "comments:update:any"
    | "comments:delete:own"
    | "comments:delete:any"
    // Users
    | "users:read:own"
    | "users:read:any"
    | "users:update:own"
    | "users:update:any"
    | "users:delete:own"
    | "users:delete:any"
    | "users:ban"
    // Rooms
    | "rooms:create:public"
    | "rooms:create:private"
    | "rooms:join:public"
    | "rooms:manage"
    // Messages
    | "messages:create"
    | "messages:update:own"
    | "messages:delete:own"
    | "messages:delete:any"
    // Admin
    | "admin:*";

/**
 * Metadata key para permisos
 */
export const PERMISSIONS_KEY = "permissions";

/**
 * Decorador @Permissions()
 *
 * Define los permisos específicos requeridos para una ruta.
 * Usa lógica AND: TODOS los permisos especificados son requeridos.
 *
 * @example
 * ```typescript
 * @Permissions('posts:delete:any')
 * @Delete('posts/:id')
 * async deletePost() { ... }
 * ```
 */
export const Permissions = (...permissions: Permission[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Matriz de permisos por rol
 *
 * Define qué permisos tiene cada rol por defecto.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    user: [
        "posts:create",
        "posts:read:any",
        "posts:update:own",
        "posts:delete:own",
        "comments:create",
        "comments:update:own",
        "comments:delete:own",
        "users:read:own",
        "users:update:own",
        "rooms:create:private",
        "rooms:join:public",
        "messages:create",
        "messages:update:own",
        "messages:delete:own",
    ],
    moderator: [
        // Hereda todos los de user
        "posts:create",
        "posts:read:any",
        "posts:update:own",
        "posts:update:any",
        "posts:delete:own",
        "posts:delete:any",
        "posts:flag",
        "comments:create",
        "comments:update:own",
        "comments:update:any",
        "comments:delete:own",
        "comments:delete:any",
        "users:read:own",
        "users:read:any",
        "users:update:own",
        "users:ban",
        "rooms:create:private",
        "rooms:create:public",
        "rooms:join:public",
        "rooms:manage",
        "messages:create",
        "messages:update:own",
        "messages:delete:own",
        "messages:delete:any",
    ],
    admin: [
        "admin:*", // Acceso total
    ],
};

/**
 * Verifica si un rol tiene un permiso específico
 */
export function roleHasPermission(
    role: string,
    permission: Permission,
): boolean {
    const rolePerms = ROLE_PERMISSIONS[role];

    if (!rolePerms) {
        return false;
    }

    // Admin tiene acceso total
    if (rolePerms.includes("admin:*")) {
        return true;
    }

    return rolePerms.includes(permission);
}

/**
 * Obtiene todos los permisos de un rol
 */
export function getRolePermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}
