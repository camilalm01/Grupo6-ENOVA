import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ProfileService } from "./profile/profile.service";
import { SupabaseService } from "./supabase/supabase.service";
import { EventsModule } from "./events/events.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),
        EventsModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, ProfileService, SupabaseService],
})
export class AuthModule {}
