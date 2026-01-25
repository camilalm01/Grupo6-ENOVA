#!/usr/bin/env ts-node

/**
 * Script de Verificación de Migración
 *
 * Compara datos entre la DB legacy y las nuevas DBs para asegurar
 * que la migración fue exitosa.
 *
 * Uso: npx ts-node scripts/verify-migration.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// Configuración (leer de .env en producción)
const LEGACY_URL = process.env.SUPABASE_URL || "";
const LEGACY_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const AUTH_DB_URL = process.env.AUTH_DATABASE_URL || "";
const COMMUNITY_DB_URL = process.env.COMMUNITY_DATABASE_URL || "";
const CHAT_DB_URL = process.env.CHAT_DATABASE_URL || "";

interface VerificationResult {
    table: string;
    legacyCount: number;
    newCount: number;
    match: boolean;
    hashMatch?: boolean;
    sampleMismatches?: string[];
}

class MigrationVerifier {
    private legacyClient: SupabaseClient;
    private authClient: SupabaseClient;
    private communityClient: SupabaseClient;
    private chatClient: SupabaseClient;

    constructor() {
        this.legacyClient = createClient(LEGACY_URL, LEGACY_KEY);
        // En producción, estos serían clientes separados
        this.authClient = createClient(AUTH_DB_URL || LEGACY_URL, LEGACY_KEY);
        this.communityClient = createClient(
            COMMUNITY_DB_URL || LEGACY_URL,
            LEGACY_KEY,
        );
        this.chatClient = createClient(CHAT_DB_URL || LEGACY_URL, LEGACY_KEY);
    }

    /**
     * Ejecutar verificación completa
     */
    async verify(): Promise<void> {
        console.log(
            "═══════════════════════════════════════════════════════════",
        );
        console.log("  VERIFICACIÓN DE MIGRACIÓN - ENOVA");
        console.log(
            "═══════════════════════════════════════════════════════════\n",
        );

        const results: VerificationResult[] = [];

        // Verificar profiles
        console.log("📊 Verificando profiles...");
        results.push(await this.verifyProfiles());

        // Verificar posts
        console.log("📊 Verificando posts...");
        results.push(await this.verifyPosts());

        // Verificar messages
        console.log("📊 Verificando messages...");
        results.push(await this.verifyMessages());

        // Resumen
        this.printSummary(results);
    }

    /**
     * Verificar tabla profiles
     */
    private async verifyProfiles(): Promise<VerificationResult> {
        const { count: legacyCount } = await this.legacyClient
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null);

        const { count: newCount } = await this.authClient
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null);

        const match = legacyCount === newCount;

        // Verificar hash de datos críticos
        let hashMatch = true;
        if (match && legacyCount! > 0) {
            hashMatch = await this.compareHashes(
                this.legacyClient,
                this.authClient,
                "profiles",
                ["id", "email", "display_name"],
            );
        }

        console.log(
            `   Legacy: ${legacyCount}, Nueva: ${newCount}, Match: ${
                match ? "✅" : "❌"
            }`,
        );

        return {
            table: "profiles",
            legacyCount: legacyCount || 0,
            newCount: newCount || 0,
            match,
            hashMatch,
        };
    }

    /**
     * Verificar tabla posts
     */
    private async verifyPosts(): Promise<VerificationResult> {
        const { count: legacyCount } = await this.legacyClient
            .from("posts")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null);

        const { count: newCount } = await this.communityClient
            .from("posts")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null);

        const match = legacyCount === newCount;

        console.log(
            `   Legacy: ${legacyCount}, Nueva: ${newCount}, Match: ${
                match ? "✅" : "❌"
            }`,
        );

        // Buscar posts faltantes
        const sampleMismatches: string[] = [];
        if (!match) {
            const { data: legacyIds } = await this.legacyClient
                .from("posts")
                .select("id")
                .is("deleted_at", null)
                .limit(100);

            for (const post of legacyIds || []) {
                const { data: newPost } = await this.communityClient
                    .from("posts")
                    .select("id")
                    .eq("legacy_id", post.id)
                    .single();

                if (!newPost) {
                    sampleMismatches.push(post.id);
                    if (sampleMismatches.length >= 5) break;
                }
            }
        }

        return {
            table: "posts",
            legacyCount: legacyCount || 0,
            newCount: newCount || 0,
            match,
            sampleMismatches,
        };
    }

    /**
     * Verificar tabla messages
     */
    private async verifyMessages(): Promise<VerificationResult> {
        const { count: legacyCount } = await this.legacyClient
            .from("chat_messages")
            .select("*", { count: "exact", head: true });

        const { count: newCount } = await this.chatClient
            .from("messages")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null);

        const match = legacyCount === newCount;

        console.log(
            `   Legacy: ${legacyCount}, Nueva: ${newCount}, Match: ${
                match ? "✅" : "❌"
            }`,
        );

        return {
            table: "messages",
            legacyCount: legacyCount || 0,
            newCount: newCount || 0,
            match,
        };
    }

    /**
     * Comparar hashes de datos entre DBs
     */
    private async compareHashes(
        legacyClient: SupabaseClient,
        newClient: SupabaseClient,
        table: string,
        fields: string[],
    ): Promise<boolean> {
        const { data: legacyData } = await legacyClient
            .from(table)
            .select(fields.join(","))
            .is("deleted_at", null)
            .order("id")
            .limit(1000);

        const { data: newData } = await newClient
            .from(table)
            .select(fields.join(","))
            .is("deleted_at", null)
            .order("id")
            .limit(1000);

        const legacyHash = this.hashData(legacyData || []);
        const newHash = this.hashData(newData || []);

        return legacyHash === newHash;
    }

    /**
     * Generar hash de un array de datos
     */
    private hashData(data: unknown[]): string {
        const str = JSON.stringify(
            data.sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b))
            ),
        );
        return crypto.createHash("md5").update(str).digest("hex");
    }

    /**
     * Imprimir resumen de verificación
     */
    private printSummary(results: VerificationResult[]): void {
        console.log(
            "\n═══════════════════════════════════════════════════════════",
        );
        console.log("  RESUMEN");
        console.log(
            "═══════════════════════════════════════════════════════════\n",
        );

        const allMatch = results.every((r) => r.match);

        for (const result of results) {
            const status = result.match ? "✅ OK" : "❌ MISMATCH";
            console.log(
                `${status} ${result.table}: ${result.legacyCount} → ${result.newCount}`,
            );

            if (result.sampleMismatches?.length) {
                console.log(
                    `   ⚠️ IDs faltantes: ${
                        result.sampleMismatches.join(", ")
                    }`,
                );
            }
        }

        console.log(
            "\n───────────────────────────────────────────────────────────",
        );
        if (allMatch) {
            console.log(
                "✅ VERIFICACIÓN EXITOSA - Migración completada correctamente",
            );
        } else {
            console.log(
                "❌ VERIFICACIÓN FALLIDA - Revisar datos antes de cutover",
            );
        }
        console.log(
            "───────────────────────────────────────────────────────────\n",
        );
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const verifier = new MigrationVerifier();
    verifier.verify().catch(console.error);
}

export { MigrationVerifier };
