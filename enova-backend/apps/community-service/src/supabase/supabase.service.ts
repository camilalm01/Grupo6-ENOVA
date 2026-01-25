import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
    private client: SupabaseClient;
    private readonly logger = new Logger(SupabaseService.name);

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
        const serviceRoleKey = this.configService.get<string>(
            "SUPABASE_SERVICE_ROLE_KEY",
        );

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error(
                "❌ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados.",
            );
        }

        this.client = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        this.logger.log("Supabase client inicializado");
    }

    getClient(): SupabaseClient {
        return this.client;
    }
}
