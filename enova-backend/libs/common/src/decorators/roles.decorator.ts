import { SetMetadata } from "@nestjs/common";

/**
 * Roles disponibles en ENOVA
 */
export type AppRole = "user" | "moderator" | "admin";

/**
 * Metadata key para roles
 */
export const ROLES_KEY = "roles";

/**
 * Decorador @Roles()
 *
 * Define los roles permitidos para acceder a una ruta.
 * Usa lógica OR: cualquiera de los roles especificados permite acceso.
 *
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @Get('admin/users')
 * async getUsers() { ... }
 * ```
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorador @AdminOnly()
 * Shorthand para @Roles('admin')
 */
export const AdminOnly = () => Roles("admin");

/**
 * Decorador @ModeratorOnly()
 * Shorthand para @Roles('admin', 'moderator')
 */
export const ModeratorOnly = () => Roles("admin", "moderator");
