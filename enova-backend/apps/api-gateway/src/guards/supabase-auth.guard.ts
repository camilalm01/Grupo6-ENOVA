import {
    CanActivate,
    ExecutionContext,
    Injectable,
    SetMetadata,
    UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Decorador para rutas públicas
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    private supabase: SupabaseClient;

    constructor(
        private reflector: Reflector,
        private configService: ConfigService,
    ) {
        const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
        const supabaseAnonKey = this.configService.get<string>(
            "SUPABASE_ANON_KEY",
        );

        if (!supabaseUrl || !supabaseAnonKey) {
            console.warn(
                "⚠️  Supabase credentials not configured. Auth guard will reject all requests.",
            );
        }

        this.supabase = createClient(
            supabaseUrl || "",
            supabaseAnonKey || "",
        );
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Verificar si la ruta es pública
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [
                context.getHandler(),
                context.getClass(),
            ],
        );
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException("Token no proporcionado");
        }

        try {
            // Validar token con Supabase
            const { data, error } = await this.supabase.auth.getUser(token);

            if (error || !data.user) {
                throw new UnauthorizedException("Token inválido");
            }

            // Adjuntar usuario al request para uso posterior
            request.user = {
                id: data.user.id,
                email: data.user.email,
                role: data.user.role,
                ...data.user.user_metadata,
            };

            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException("Error al validar token");
        }
    }

    private extractTokenFromHeader(
        request: { headers: { authorization?: string } },
    ): string | undefined {
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        return type === "Bearer" ? token : undefined;
    }
}
