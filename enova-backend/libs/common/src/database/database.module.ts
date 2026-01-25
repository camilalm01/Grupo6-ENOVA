import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Token de inyección para la conexión legacy (Supabase original)
 */
export const LEGACY_DATABASE = "LEGACY_DATABASE";

/**
 * Token de inyección para la conexión nueva (DB dedicada del servicio)
 */
export const NEW_DATABASE = "NEW_DATABASE";

/**
 * Interfaz para las conexiones de base de datos
 */
export interface DatabaseConnections {
    legacy: SupabaseClient;
    new: SupabaseClient;
}

/**
 * Módulo de base de datos multi-conexión
 *
 * Proporciona dos conexiones:
 * - LEGACY_DATABASE: Supabase original (para migración)
 * - NEW_DATABASE: Nueva DB dedicada del microservicio
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: LEGACY_DATABASE,
            inject: [ConfigService],
            useFactory: (configService: ConfigService): SupabaseClient => {
                const url = configService.get<string>("SUPABASE_URL");
                const key = configService.get<string>(
                    "SUPABASE_SERVICE_ROLE_KEY",
                );

                if (!url || !key) {
                    throw new Error(
                        "SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos",
                    );
                }

                return createClient(url, key, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                    },
                });
            },
        },
        {
            provide: NEW_DATABASE,
            inject: [ConfigService],
            useFactory: (configService: ConfigService): SupabaseClient => {
                // Para la nueva DB, usamos las credenciales específicas del servicio
                const url =
                    configService.get<string>("COMMUNITY_SUPABASE_URL") ||
                    configService.get<string>("SUPABASE_URL");
                const key =
                    configService.get<string>("COMMUNITY_SUPABASE_KEY") ||
                    configService.get<string>("SUPABASE_SERVICE_ROLE_KEY");

                if (!url || !key) {
                    throw new Error("Credenciales de nueva DB no configuradas");
                }

                return createClient(url, key, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                    },
                });
            },
        },
    ],
    exports: [LEGACY_DATABASE, NEW_DATABASE],
})
export class DatabaseModule {}
