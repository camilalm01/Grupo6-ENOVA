"use client";

/**
 * ENOVA - Feed Component with Server-First Architecture
 *
 * This is the Client Component wrapper that handles:
 * - Data fetching with TanStack Query
 * - Error boundaries for graceful degradation
 * - Optimistic updates for interactions
 */

import { Suspense } from "react";
import {
  usePosts,
  useCreatePost,
  useLikePost,
  useDeletePost,
} from "@/lib/hooks/use-api";
import {
  CommunityErrorBoundary,
  InlineError,
} from "@/lib/components/error-boundary";
import { FeedSkeleton, PostSkeleton } from "@/lib/components/skeletons";
import type { Post } from "@/lib/hooks/use-api";

// ═══════════════════════════════════════════════════════════════════════════════
// POST CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
  onLike?: (postId: string, isLiked: boolean) => void;
}

function PostCard({ post, currentUserId, onDelete, onLike }: PostCardProps) {
  const isOwn = post.userId === currentUserId;
  const isOptimistic = post.id.startsWith("temp-");

  return (
    <article
      className={`bg-white rounded-2xl p-6 shadow-sm border border-purple-100 transition-all hover:shadow-md ${isOptimistic ? "opacity-70" : ""}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-lg">
            {post.author?.fullName?.charAt(0) || "👤"}
          </div>

          <div>
            <h3 className="font-semibold text-gray-800">
              {post.author?.fullName || "Usuaria ENOVA"}
            </h3>
            <time className="text-xs text-purple-400">
              {formatRelativeTime(post.createdAt)}
            </time>
          </div>
        </div>

        {/* Actions menu */}
        {isOwn && !isOptimistic && (
          <button
            onClick={() => onDelete?.(post.id)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            aria-label="Eliminar publicación"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </header>

      {/* Content */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Image */}
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt="Imagen de la publicación"
            className="mt-4 rounded-xl w-full object-cover max-h-96"
            loading="lazy"
          />
        )}

        {/* Category tag */}
        {post.category && (
          <span className="inline-block mt-3 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            #{post.category}
          </span>
        )}
      </div>

      {/* Engagement stats */}
      <footer className="flex items-center gap-4 pt-4 border-t border-purple-50">
        {/* Like button */}
        <button
          onClick={() => onLike?.(post.id, post.isLiked || false)}
          disabled={isOptimistic}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            post.isLiked
              ? "bg-pink-100 text-pink-600"
              : "text-gray-500 hover:bg-purple-50 hover:text-purple-600"
          }`}
        >
          <span>{post.isLiked ? "❤️" : "🤍"}</span>
          <span>{post.likesCount || 0}</span>
        </button>

        {/* Comments */}
        <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-500 hover:bg-purple-50 hover:text-purple-600 transition-all">
          <span>💬</span>
          <span>{post.commentsCount || 0}</span>
        </button>

        {/* Share */}
        <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-500 hover:bg-purple-50 hover:text-purple-600 transition-all ml-auto">
          <span>📤</span>
          <span>Compartir</span>
        </button>
      </footer>

      {/* Optimistic indicator */}
      {isOptimistic && (
        <div className="mt-3 text-xs text-purple-400 flex items-center gap-2">
          <span className="animate-pulse">●</span>
          Publicando...
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE POST COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface CreatePostProps {
  onSubmit: (content: string, category?: string) => void;
  isLoading: boolean;
  userAvatar?: string;
}

function CreatePost({ onSubmit, isLoading, userAvatar }: CreatePostProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    onSubmit(content.trim(), category || undefined);
    setContent("");
    setCategory("");
    setIsExpanded(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white flex-shrink-0">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            "👤"
          )}
        </div>

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="¿Qué quieres compartir hoy?"
            rows={isExpanded ? 3 : 1}
            className="w-full px-4 py-3 bg-purple-50 rounded-xl border border-transparent text-sm placeholder:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all resize-none"
          />

          {isExpanded && (
            <div className="flex items-center justify-between mt-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 bg-purple-50 rounded-lg text-sm text-purple-600 border-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">Categoría (opcional)</option>
                <option value="bienestar">🌸 Bienestar</option>
                <option value="empleo">💼 Empleo</option>
                <option value="comunidad">👥 Comunidad</option>
                <option value="recursos">📚 Recursos</option>
                <option value="celebracion">🎉 Celebración</option>
              </select>

              <button
                type="submit"
                disabled={!content.trim() || isLoading}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Publicando..." : "Publicar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

// Need to import useState for CreatePost
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// FEED CONTENT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface FeedContentProps {
  currentUserId?: string;
  userAvatar?: string;
}

function FeedContent({ currentUserId, userAvatar }: FeedContentProps) {
  const { data: posts, isLoading, error, refetch } = usePosts({ limit: 20 });
  const createPost = useCreatePost();
  const likePost = useLikePost();
  const deletePost = useDeletePost();

  const handleCreatePost = (content: string, category?: string) => {
    createPost.mutate({ content, category });
  };

  const handleLike = (postId: string, isLiked: boolean) => {
    likePost.mutate({ postId, isLiked });
  };

  const handleDelete = (postId: string) => {
    if (confirm("¿Estás segura de que quieres eliminar esta publicación?")) {
      deletePost.mutate(postId);
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <InlineError
          message="No pudimos cargar las publicaciones. El servicio de comunidad podría estar temporalmente no disponible."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create post */}
      <CreatePost
        onSubmit={handleCreatePost}
        isLoading={createPost.isPending}
        userAvatar={userAvatar}
      />

      {/* Loading state */}
      {isLoading && <PostSkeleton />}

      {/* Posts list */}
      {posts && posts.length > 0 ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onLike={handleLike}
          />
        ))
      ) : !isLoading ? (
        <div className="text-center py-12 text-purple-400">
          <span className="text-4xl block mb-4">🌸</span>
          <p className="font-medium">Aún no hay publicaciones</p>
          <p className="text-sm">¡Sé la primera en compartir algo!</p>
        </div>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FEED COMPONENT WITH ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════════

interface FeedProps {
  currentUserId?: string;
  userAvatar?: string;
}

export default function Feed({ currentUserId, userAvatar }: FeedProps) {
  return (
    <CommunityErrorBoundary>
      <Suspense fallback={<FeedSkeleton />}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <FeedContent currentUserId={currentUserId} userAvatar={userAvatar} />
        </div>
      </Suspense>
    </CommunityErrorBoundary>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}
