import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

/**
 * Metadata key para el decorador @ResourceOwner
 */
export const RESOURCE_OWNER_KEY = "resource_owner";

export interface ResourceOwnerOptions {
    /** Nombre del servicio para obtener el recurso */
    service: string;
    /** Nombre del método para obtener el recurso */
    method: string;
    /** Campo del recurso que contiene el owner ID */
    ownerField: string;
    /** Nombre del parámetro de ruta que contiene el resource ID */
    resourceParam: string;
    /** Roles que pueden acceder sin ser owners */
    bypassRoles?: string[];
}

/**
 * Decorador para marcar endpoints que requieren ownership
 *
 * @example
 * ```typescript
 * @ResourceOwner({
 *   service: 'PostsService',
 *   method: 'findById',
 *   ownerField: 'authorId',
 *   resourceParam: 'postId',
 *   bypassRoles: ['admin', 'moderator']
 * })
 * @Patch('posts/:postId')
 * async updatePost() { ... }
 * ```
 */
export const ResourceOwner = (options: ResourceOwnerOptions) =>
    Reflector.createDecorator<ResourceOwnerOptions>()(options);

/**
 * Guard que verifica ownership del recurso
 *
 * Reemplaza las políticas RLS de Supabase a nivel de aplicación.
 *
 * Ejemplo de política RLS que reemplaza:
 * ```sql
 * CREATE POLICY "Users can update own posts"
 * ON posts FOR UPDATE
 * USING (auth.uid() = author_id);
 * ```
 */
@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
    private readonly logger = new Logger(ResourceOwnershipGuard.name);
    private readonly services = new Map<string, unknown>();

    constructor(private reflector: Reflector) {}

    /**
     * Registra un servicio para que el guard pueda usarlo
     */
    registerService(name: string, service: unknown): void {
        this.services.set(name, service);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const options = this.reflector.get<ResourceOwnerOptions>(
            RESOURCE_OWNER_KEY,
            context.getHandler(),
        );

        // Si no hay decorador, permitir acceso
        if (!options) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException("Usuario no autenticado");
        }

        // Verificar si el usuario tiene rol de bypass
        if (options.bypassRoles?.includes(user.role)) {
            this.logger.debug(
                `Usuario ${user.id} tiene rol ${user.role}, bypass ownership check`,
            );
            return true;
        }

        // Obtener el ID del recurso del parámetro de ruta
        const resourceId = request.params[options.resourceParam];
        if (!resourceId) {
            throw new NotFoundException(
                `Parámetro ${options.resourceParam} no encontrado`,
            );
        }

        // Obtener el servicio registrado
        const service = this.services.get(options.service);
        if (!service) {
            this.logger.error(
                `Servicio ${options.service} no registrado en ResourceOwnershipGuard`,
            );
            throw new Error(`Servicio ${options.service} no configurado`);
        }

        // Llamar al método para obtener el recurso
        const method = (service as Record<string, unknown>)[options.method];
        if (typeof method !== "function") {
            throw new Error(
                `Método ${options.method} no encontrado en ${options.service}`,
            );
        }

        const resource = await method.call(service, resourceId);
        if (!resource) {
            throw new NotFoundException("Recurso no encontrado");
        }

        // Verificar ownership
        const ownerId =
            (resource as Record<string, unknown>)[options.ownerField];
        if (ownerId !== user.id) {
            this.logger.warn(
                `Usuario ${user.id} intentó acceder a recurso de ${ownerId}`,
            );
            throw new ForbiddenException(
                "No tienes permiso para acceder a este recurso",
            );
        }

        // Adjuntar el recurso al request para evitar doble query
        request.resource = resource;
        return true;
    }
}
