import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseClient } from "@supabase/supabase-js";
import { LEGACY_DATABASE, NEW_DATABASE } from "./database.module";

/**
 * Fases de migración
 */
export type MigrationPhase =
    | "legacy_only" // Solo usa DB legacy
    | "dual_write" // Escribe en ambas DBs
    | "verify" // Verificando paridad
    | "cutover" // Leyendo de nueva, escribiendo en ambas
    | "new_only"; // Solo usa nueva DB (migración completa)

/**
 * Resultado de operación dual
 */
export interface DualWriteResult<T> {
    data: T;
    source: "legacy" | "new";
    syncStatus?: "synced" | "pending" | "failed";
}

/**
 * Servicio de Dual Write para migración zero-downtime
 *
 * Durante la migración, escribe en ambas bases de datos
 * y lee de la DB primaria según la fase de migración.
 */
@Injectable()
export class DualWriteService {
    private readonly logger = new Logger(DualWriteService.name);
    private readonly phase: MigrationPhase;

    constructor(
        @Inject(LEGACY_DATABASE) private readonly legacyDb: SupabaseClient,
        @Inject(NEW_DATABASE) private readonly newDb: SupabaseClient,
        private readonly configService: ConfigService,
    ) {
        this.phase =
            this.configService.get<MigrationPhase>("MIGRATION_PHASE") ||
            "legacy_only";
        this.logger.log(`Fase de migración: ${this.phase}`);
    }

    /**
     * Obtiene la fase actual de migración
     */
    getPhase(): MigrationPhase {
        return this.phase;
    }

    /**
     * Obtiene el cliente de DB para lectura según la fase
     */
    getReadClient(): SupabaseClient {
        switch (this.phase) {
            case "cutover":
            case "new_only":
                return this.newDb;
            default:
                return this.legacyDb;
        }
    }

    /**
     * Obtiene el cliente legacy
     */
    getLegacyClient(): SupabaseClient {
        return this.legacyDb;
    }

    /**
     * Obtiene el cliente nuevo
     */
    getNewClient(): SupabaseClient {
        return this.newDb;
    }

    /**
     * Escribe en la(s) DB(s) según la fase de migración
     *
     * @param table Nombre de la tabla
     * @param data Datos a insertar/actualizar
     * @param options Opciones adicionales
     */
    async write<T extends Record<string, unknown>>(
        table: string,
        data: T,
        options: { upsert?: boolean; onConflict?: string } = {},
    ): Promise<DualWriteResult<T>> {
        const { upsert = false, onConflict } = options;

        switch (this.phase) {
            case "legacy_only":
                return this.writeLegacy(table, data, { upsert, onConflict });

            case "dual_write":
            case "verify":
            case "cutover":
                return this.writeBoth(table, data, { upsert, onConflict });

            case "new_only":
                return this.writeNew(table, data, { upsert, onConflict });

            default:
                return this.writeLegacy(table, data, { upsert, onConflict });
        }
    }

    /**
     * Escribe solo en la DB legacy
     */
    private async writeLegacy<T extends Record<string, unknown>>(
        table: string,
        data: T,
        options: { upsert?: boolean; onConflict?: string },
    ): Promise<DualWriteResult<T>> {
        const query = options.upsert
            ? this.legacyDb.from(table).upsert(data, {
                onConflict: options.onConflict,
            })
            : this.legacyDb.from(table).insert(data);

        const { data: result, error } = await query.select().single();

        if (error) {
            this.logger.error(
                `Error escribiendo en legacy ${table}: ${error.message}`,
            );
            throw error;
        }

        return { data: result as T, source: "legacy" };
    }

    /**
     * Escribe solo en la nueva DB
     */
    private async writeNew<T extends Record<string, unknown>>(
        table: string,
        data: T,
        options: { upsert?: boolean; onConflict?: string },
    ): Promise<DualWriteResult<T>> {
        // Agregar legacy_id si existe en los datos
        const dataWithLegacy = {
            ...data,
            legacy_id: (data as { id?: string }).id || null,
            migrated_at: new Date().toISOString(),
        };

        const query = options.upsert
            ? this.newDb.from(table).upsert(dataWithLegacy, {
                onConflict: options.onConflict,
            })
            : this.newDb.from(table).insert(dataWithLegacy);

        const { data: result, error } = await query.select().single();

        if (error) {
            this.logger.error(
                `Error escribiendo en nueva DB ${table}: ${error.message}`,
            );
            throw error;
        }

        return { data: result as T, source: "new" };
    }

    /**
     * Escribe en ambas DBs (dual write)
     */
    private async writeBoth<T extends Record<string, unknown>>(
        table: string,
        data: T,
        options: { upsert?: boolean; onConflict?: string },
    ): Promise<DualWriteResult<T>> {
        // Escribir primero en legacy (fuente de verdad durante migración)
        const legacyResult = await this.writeLegacy(table, data, options);

        // Escribir en paralelo en la nueva DB (asincrónicamente)
        this.writeNew(table, data, options)
            .then(() => {
                this.logger.debug(
                    `Sync a nueva DB exitoso para ${table}: ${
                        (data as { id?: string }).id
                    }`,
                );
            })
            .catch((error) => {
                this.logger.error(
                    `Error sync a nueva DB ${table}: ${error.message}`,
                );
                // TODO: Encolar para retry
            });

        return { ...legacyResult, syncStatus: "pending" };
    }

    /**
     * Actualiza un registro en la(s) DB(s)
     */
    async update<T extends Record<string, unknown>>(
        table: string,
        id: string,
        data: Partial<T>,
    ): Promise<DualWriteResult<T>> {
        switch (this.phase) {
            case "legacy_only":
                return this.updateLegacy(table, id, data);

            case "dual_write":
            case "verify":
            case "cutover":
                return this.updateBoth(table, id, data);

            case "new_only":
                return this.updateNew(table, id, data);

            default:
                return this.updateLegacy(table, id, data);
        }
    }

    private async updateLegacy<T extends Record<string, unknown>>(
        table: string,
        id: string,
        data: Partial<T>,
    ): Promise<DualWriteResult<T>> {
        const { data: result, error } = await this.legacyDb
            .from(table)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return { data: result as T, source: "legacy" };
    }

    private async updateNew<T extends Record<string, unknown>>(
        table: string,
        id: string,
        data: Partial<T>,
    ): Promise<DualWriteResult<T>> {
        const { data: result, error } = await this.newDb
            .from(table)
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return { data: result as T, source: "new" };
    }

    private async updateBoth<T extends Record<string, unknown>>(
        table: string,
        id: string,
        data: Partial<T>,
    ): Promise<DualWriteResult<T>> {
        const legacyResult = await this.updateLegacy(table, id, data);

        // Actualizar nueva DB en paralelo
        this.updateNew(table, id, data).catch((error) => {
            this.logger.error(
                `Error actualizando nueva DB ${table}/${id}: ${error.message}`,
            );
        });

        return { ...legacyResult, syncStatus: "pending" };
    }

    /**
     * Lee un registro de la DB apropiada
     */
    async read<T>(table: string, id: string): Promise<T | null> {
        const client = this.getReadClient();

        const { data, error } = await client
            .from(table)
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            if (error.code === "PGRST116") return null; // Not found
            throw error;
        }

        return data as T;
    }

    /**
     * Soft delete en la(s) DB(s)
     */
    async softDelete(table: string, id: string): Promise<void> {
        const deleteData = { deleted_at: new Date().toISOString() };

        switch (this.phase) {
            case "legacy_only":
                await this.legacyDb.from(table).update(deleteData).eq("id", id);
                break;

            case "dual_write":
            case "verify":
            case "cutover":
                await Promise.all([
                    this.legacyDb.from(table).update(deleteData).eq("id", id),
                    this.newDb.from(table).update(deleteData).eq("id", id),
                ]);
                break;

            case "new_only":
                await this.newDb.from(table).update(deleteData).eq("id", id);
                break;
        }
    }
}
