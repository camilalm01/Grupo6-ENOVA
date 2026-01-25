import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreatePostDto } from "./dto/create-post.dto";

export interface Post {
    id: string;
    author_id: string;
    title: string;
    content: string;
    category: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

@Injectable()
export class PostsService {
    private readonly logger = new Logger(PostsService.name);

    constructor(private readonly supabaseService: SupabaseService) {}

    /**
     * Obtener todos los posts (paginados)
     */
    async getPosts(limit: number = 20, offset: number = 0): Promise<Post[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("posts")
            .select("*")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.logger.error(`Error obteniendo posts: ${error.message}`);
            throw error;
        }

        return data as Post[];
    }

    /**
     * Obtener posts de un usuario específico
     */
    async getPostsByUser(userId: string, limit: number = 10): Promise<Post[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("posts")
            .select("*")
            .eq("author_id", userId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            this.logger.error(
                `Error obteniendo posts del usuario: ${error.message}`,
            );
            throw error;
        }

        return data as Post[];
    }

    /**
     * Obtener un post por ID
     */
    async getPost(postId: string): Promise<Post> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("posts")
            .select("*")
            .eq("id", postId)
            .is("deleted_at", null)
            .single();

        if (error || !data) {
            throw new NotFoundException(`Post no encontrado: ${postId}`);
        }

        return data as Post;
    }

    /**
     * Crear un nuevo post
     */
    async createPost(authorId: string, postData: CreatePostDto): Promise<Post> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from("posts")
            .insert([
                {
                    author_id: authorId,
                    title: postData.title,
                    content: postData.content,
                    category: postData.category || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            ])
            .select()
            .single();

        if (error) {
            this.logger.error(`Error creando post: ${error.message}`);
            throw error;
        }

        this.logger.log(`Post creado: ${data.id} por usuario ${authorId}`);
        return data as Post;
    }

    /**
     * Eliminar todos los posts de un usuario (para Saga de eliminación de cuenta)
     */
    async deletePostsByUser(userId: string): Promise<{ deletedCount: number }> {
        // Primero contar los posts a eliminar
        const { count } = await this.supabaseService
            .getClient()
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("author_id", userId)
            .is("deleted_at", null);

        // Soft delete: marcar como eliminados
        const { error } = await this.supabaseService
            .getClient()
            .from("posts")
            .update({ deleted_at: new Date().toISOString() })
            .eq("author_id", userId)
            .is("deleted_at", null);

        if (error) {
            this.logger.error(
                `Error eliminando posts del usuario ${userId}: ${error.message}`,
            );
            throw error;
        }

        this.logger.log(
            `Posts eliminados para usuario ${userId}: ${count || 0}`,
        );
        return { deletedCount: count || 0 };
    }

    /**
     * Restaurar posts de un usuario (compensación de Saga)
     */
    async restorePostsByUser(
        userId: string,
    ): Promise<{ restoredCount: number }> {
        // Contar posts a restaurar
        const { count } = await this.supabaseService
            .getClient()
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("author_id", userId)
            .not("deleted_at", "is", null);

        // Restaurar: quitar deleted_at
        const { error } = await this.supabaseService
            .getClient()
            .from("posts")
            .update({ deleted_at: null })
            .eq("author_id", userId)
            .not("deleted_at", "is", null);

        if (error) {
            this.logger.error(
                `Error restaurando posts del usuario ${userId}: ${error.message}`,
            );
            throw error;
        }

        this.logger.log(
            `Posts restaurados para usuario ${userId}: ${count || 0}`,
        );
        return { restoredCount: count || 0 };
    }
}
