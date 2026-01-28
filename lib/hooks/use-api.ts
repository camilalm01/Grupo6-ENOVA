"use client";

/**
 * ENOVA - API Hooks with TanStack Query
 *
 * Custom hooks for data fetching with:
 * - Automatic caching and invalidation
 * - Optimistic updates support
 * - Error handling
 * - Loading states
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import {
  api,
  communityApi,
  authApi,
  chatApi,
  healthApi,
  type ApiResponse,
} from "../api/http-client";
import { queryKeys, staleTime } from "../providers/query-provider";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Post {
  id: string;
  userId: string;
  content: string;
  category?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
  author?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  memberCount: number;
  lastMessage?: {
    content: string;
    timestamp: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch current user profile
 */
export function useProfile(
  options?: Omit<UseQueryOptions<UserProfile | null>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.auth.profile(),
    queryFn: async () => {
      const response = (await authApi.getProfile()) as ApiResponse<UserProfile>;
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: staleTime.medium,
    ...options,
  });
}

/**
 * Update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await authApi.updateProfile(data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data as UserProfile;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.profile(), data);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POSTS HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

interface PostsFilters {
  category?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch posts list with filters
 */
export function usePosts(
  filters: PostsFilters = {},
  options?: Omit<UseQueryOptions<Post[]>, "queryKey" | "queryFn">,
) {
  const { limit = 20, offset = 0, category } = filters;

  return useQuery({
    queryKey: queryKeys.posts.list({ category, limit }),
    queryFn: async () => {
      const response = (await communityApi.getPosts({
        limit,
        offset,
        category,
      })) as ApiResponse<Post[]>;
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data || [];
    },
    staleTime: staleTime.short,
    ...options,
  });
}

/**
 * Fetch single post
 */
export function usePost(
  postId: string,
  options?: Omit<UseQueryOptions<Post | null>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: async () => {
      const response = (await communityApi.getPost(
        postId,
      )) as ApiResponse<Post>;
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!postId,
    staleTime: staleTime.short,
    ...options,
  });
}

/**
 * Create a new post with optimistic update
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      content: string;
      category?: string;
      imageUrl?: string;
    }) => {
      const response = await communityApi.createPost(data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data as Post;
    },
    onMutate: async (newPost) => {
      // Cancel ALL outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.all });

      // Get all cached posts queries
      const queriesData = queryClient.getQueriesData<Post[]>({
        queryKey: queryKeys.posts.lists(),
      });

      // Create optimistic post
      const optimisticPost: Post = {
        id: `temp-${Date.now()}`,
        userId: "current-user",
        content: newPost.content,
        category: newPost.category,
        imageUrl: newPost.imageUrl,
        createdAt: new Date().toISOString(),
      };

      // Update all cached queries with optimistic post
      queriesData.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: Post[] = []) => {
          return [optimisticPost, ...old];
        });
      });

      return { queriesData };
    },
    onError: (_err, _newPost, context) => {
      // Rollback all queries on error
      if (context?.queriesData) {
        context.queriesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch ALL posts queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

/**
 * Delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await communityApi.deletePost(postId);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return postId;
    },
    onMutate: async (postId) => {
      // Cancel ALL posts queries (including those with filters)
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.all });

      // Get all cached posts queries
      const queriesData = queryClient.getQueriesData<Post[]>({
        queryKey: queryKeys.posts.lists(),
      });

      // Update all cached queries
      queriesData.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: Post[] = []) =>
          old.filter((post) => post.id !== postId),
        );
      });

      return { queriesData };
    },
    onError: (_err, _postId, context) => {
      // Rollback all queries on error
      if (context?.queriesData) {
        context.queriesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Invalidate ALL posts queries
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });
}

/**
 * Like/Unlike a post
 */
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      isLiked,
    }: {
      postId: string;
      isLiked: boolean;
    }) => {
      const response = isLiked
        ? await communityApi.unlikePost(postId)
        : await communityApi.likePost(postId);

      if (response.error) {
        throw new Error(response.error.message);
      }
      return { postId, isLiked: !isLiked };
    },
    onMutate: async ({ postId, isLiked }) => {
      // Cancel ALL posts queries
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.all });

      // Get all cached posts list queries
      const queriesData = queryClient.getQueriesData<Post[]>({
        queryKey: queryKeys.posts.lists(),
      });

      // Update like in all cached lists
      queriesData.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: Post[] = []) =>
          old.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: !isLiked,
                  likesCount: (post.likesCount || 0) + (isLiked ? -1 : 1),
                }
              : post,
          ),
        );
      });

      // Also update the detail query if it exists
      const previousPost = queryClient.getQueryData<Post>(
        queryKeys.posts.detail(postId),
      );

      if (previousPost) {
        queryClient.setQueryData<Post>(queryKeys.posts.detail(postId), {
          ...previousPost,
          isLiked: !isLiked,
          likesCount: (previousPost.likesCount || 0) + (isLiked ? -1 : 1),
        });
      }

      return { queriesData, previousPost };
    },
    onError: (_err, { postId }, context) => {
      // Rollback list queries
      if (context?.queriesData) {
        context.queriesData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback detail query
      if (context?.previousPost) {
        queryClient.setQueryData(
          queryKeys.posts.detail(postId),
          context.previousPost,
        );
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch comments for a post
 */
export function useComments(
  postId: string,
  options?: Omit<UseQueryOptions<Comment[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.posts.comments(postId),
    queryFn: async () => {
      const response = (await communityApi.getComments(postId)) as ApiResponse<
        Comment[]
      >;
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data || [];
    },
    enabled: !!postId,
    staleTime: staleTime.short,
    ...options,
  });
}

/**
 * Add a comment to a post
 */
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      content,
    }: {
      postId: string;
      content: string;
    }) => {
      const response = await communityApi.addComment(postId, content);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data as Comment;
    },
    onSuccess: (_data, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.comments(postId),
      });
      // Also update comment count on the post
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.detail(postId),
      });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch chat rooms
 */
export function useChatRooms(
  options?: Omit<UseQueryOptions<ChatRoom[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.chat.rooms(),
    queryFn: async () => {
      const response = (await chatApi.getRooms()) as ApiResponse<ChatRoom[]>;
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data || [];
    },
    staleTime: staleTime.medium,
    ...options,
  });
}

/**
 * Create a new chat room
 */
export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      isPrivate?: boolean;
    }) => {
      const response = await chatApi.createRoom(data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data as ChatRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.rooms() });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check API health status
 */
export function useHealthCheck(
  options?: Omit<UseQueryOptions<{ status: string }>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: async () => {
      const response = (await healthApi.check()) as ApiResponse<{
        status: string;
      }>;
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data || { status: "unknown" };
    },
    staleTime: staleTime.short,
    refetchInterval: 30000, // Check every 30 seconds
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC FETCH HOOK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generic hook for custom API calls
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  endpoint: string,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await api.get<T>(endpoint);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data as T;
    },
    ...options,
  });
}

export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
  },
) {
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const response = await mutationFn(variables);
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data as TData;
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
