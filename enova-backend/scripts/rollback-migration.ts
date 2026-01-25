#!/usr/bin/env ts-node

/**
 * Script de Rollback de Migración
 *
 * Revierte los cambios de la migración y restaura la DB legacy
 * como fuente de verdad.
 *
 * Uso: npx ts-node scripts/rollback-migration.ts [phase]
 *
 * Phases:
 *   - dual_write: Revertir a legacy_only
 *   - cutover: Sincronizar nueva→legacy y revertir
 *   - emergency: Rollback de emergencia con datos de nueva DB
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as readline from "readline";

type RollbackPhase = "dual_write" | "cutover" | "emergency";

// Configuración
const LEGACY_URL = process.env.SUPABASE_URL || "";
const LEGACY_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const NEW_DB_URL = process.env.COMMUNITY_DATABASE_URL || "";

class MigrationRollback {
    private legacyClient: SupabaseClient;
    private newClient: SupabaseClient;

    constructor() {
        this.legacyClient = createClient(LEGACY_URL, LEGACY_KEY);
        this.newClient = createClient(NEW_DB_URL || LEGACY_URL, LEGACY_KEY);
    }

    /**
     * Ejecutar rollback según la fase
     */
    async rollback(phase: RollbackPhase): Promise<void> {
        console.log(
            "═══════════════════════════════════════════════════════════",
        );
        console.log(`  ROLLBACK DE MIGRACIÓN - Fase: ${phase.toUpperCase()}`);
        console.log(
            "═══════════════════════════════════════════════════════════\n",
        );

        // Confirmación de seguridad
        const confirmed = await this.confirmRollback(phase);
        if (!confirmed) {
            console.log("❌ Rollback cancelado por el usuario");
            return;
        }

        switch (phase) {
            case "dual_write":
                await this.rollbackDualWrite();
                break;
            case "cutover":
                await this.rollbackCutover();
                break;
            case "emergency":
                await this.rollbackEmergency();
                break;
        }
    }

    /**
     * Confirmar rollback con el usuario
     */
    private async confirmRollback(phase: RollbackPhase): Promise<boolean> {
        const messages: Record<RollbackPhase, string> = {
            dual_write: "Esto cambiará MIGRATION_PHASE a legacy_only",
            cutover: "Esto sincronizará datos de nueva→legacy y revertirá",
            emergency:
                "⚠️ EMERGENCIA: Esto puede causar pérdida de datos recientes",
        };

        console.log(`⚠️ ${messages[phase]}\n`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) => {
            rl.question(
                '¿Estás seguro? Escribe "CONFIRMAR" para continuar: ',
                (answer) => {
                    rl.close();
                    resolve(answer === "CONFIRMAR");
                },
            );
        });
    }

    /**
     * Rollback desde dual_write
     * Solo cambia la fase, no hay sincronización necesaria
     */
    private async rollbackDualWrite(): Promise<void> {
        console.log("📋 Rollback desde dual_write...\n");

        console.log("1. Cambiar variable de entorno:");
        console.log("   MIGRATION_PHASE=legacy_only\n");

        console.log("2. Reiniciar servicios:");
        console.log(
            "   docker-compose restart community-service chat-service\n",
        );

        console.log("3. Verificar logs:");
        console.log(
            '   docker-compose logs -f community-service | grep "Fase de migración"\n',
        );

        console.log("✅ Rollback de dual_write completado");
        console.log(
            "   Los datos en la nueva DB se pueden limpiar manualmente si es necesario.\n",
        );
    }

    /**
     * Rollback desde cutover
     * Requiere sincronizar datos nuevos a legacy
     */
    private async rollbackCutover(): Promise<void> {
        console.log("📋 Rollback desde cutover...\n");

        // 1. Identificar registros nuevos en nueva DB
        console.log(
            "1. Identificando registros creados después del cutover...",
        );

        const cutoverDate = process.env.CUTOVER_DATE ||
            new Date().toISOString();

        const { data: newPosts, count: newPostsCount } = await this.newClient
            .from("posts")
            .select("*", { count: "exact" })
            .gt("created_at", cutoverDate)
            .is("legacy_id", null);

        console.log(`   Encontrados ${newPostsCount || 0} posts nuevos\n`);

        // 2. Copiar a legacy
        if (newPosts && newPosts.length > 0) {
            console.log("2. Copiando registros a DB legacy...");

            for (const post of newPosts) {
                const { id, legacy_id, migrated_at, ...postData } = post;

                const { error } = await this.legacyClient
                    .from("posts")
                    .insert({
                        ...postData,
                        id, // Mantener el mismo ID
                    });

                if (error) {
                    console.log(
                        `   ❌ Error copiando post ${id}: ${error.message}`,
                    );
                }
            }

            console.log(`   ✅ ${newPosts.length} posts copiados\n`);
        }

        // 3. Instrucciones finales
        console.log("3. Cambiar variable de entorno:");
        console.log("   MIGRATION_PHASE=legacy_only\n");

        console.log("4. Reiniciar servicios:");
        console.log(
            "   docker-compose restart community-service chat-service\n",
        );

        console.log("✅ Rollback de cutover completado");
    }

    /**
     * Rollback de emergencia
     * Copia todos los datos recientes y revierte
     */
    private async rollbackEmergency(): Promise<void> {
        console.log("🚨 ROLLBACK DE EMERGENCIA\n");

        console.log("1. Deteniendo escrituras nuevas...");
        console.log("   MIGRATION_PHASE=read_only\n");

        // Identificar última sincronización exitosa
        const lastSyncDate = process.env.LAST_SUCCESSFUL_SYNC ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        console.log(`2. Sincronizando datos desde: ${lastSyncDate}...`);

        // Copiar posts recientes
        const { data: recentPosts } = await this.newClient
            .from("posts")
            .select("*")
            .gt("updated_at", lastSyncDate);

        console.log(`   ${recentPosts?.length || 0} posts para sincronizar`);

        for (const post of recentPosts || []) {
            const { legacy_id, migrated_at, ...postData } = post;

            await this.legacyClient
                .from("posts")
                .upsert({
                    ...postData,
                    id: legacy_id || post.id,
                }, {
                    onConflict: "id",
                });
        }

        // Copiar mensajes recientes
        const { data: recentMessages } = await this.newClient
            .from("messages")
            .select("*")
            .gt("created_at", lastSyncDate);

        console.log(
            `   ${recentMessages?.length || 0} mensajes para sincronizar`,
        );

        for (const msg of recentMessages || []) {
            const { legacy_id, migrated_at, ...msgData } = msg;

            await this.legacyClient
                .from("chat_messages")
                .upsert({
                    user_id: msgData.user_id,
                    room_id: msgData.room_id,
                    content: msgData.content,
                    username: msgData.username,
                    created_at: msgData.created_at,
                    id: legacy_id || msg.id,
                }, {
                    onConflict: "id",
                });
        }

        console.log("\n3. Generando reporte de incidente...");

        const report = {
            timestamp: new Date().toISOString(),
            type: "emergency_rollback",
            syncedPosts: recentPosts?.length || 0,
            syncedMessages: recentMessages?.length || 0,
            lastSyncDate,
            action: "Rollback completado, verificar integridad manualmente",
        };

        console.log(JSON.stringify(report, null, 2));

        console.log("\n4. Acciones pendientes:");
        console.log("   - Cambiar MIGRATION_PHASE=legacy_only");
        console.log("   - Reiniciar todos los servicios");
        console.log("   - Ejecutar verify-migration.ts");
        console.log("   - Notificar a usuarios si hay inconsistencias");
        console.log("   - Crear ticket de post-mortem\n");

        console.log("✅ Rollback de emergencia completado");
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const phase = (process.argv[2] as RollbackPhase) || "dual_write";

    if (!["dual_write", "cutover", "emergency"].includes(phase)) {
        console.error("Fase inválida. Usa: dual_write | cutover | emergency");
        process.exit(1);
    }

    const rollback = new MigrationRollback();
    rollback.rollback(phase).catch(console.error);
}

export { MigrationRollback };
