/**
 * ENOVA - Frontend Architecture Export Index
 *
 * Central exports for all frontend modules.
 * Import from '@/lib' for cleaner imports.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
export {
  httpClient,
  api,
  authApi,
  communityApi,
  chatApi,
  healthApi,
  getAccessToken,
  refreshToken,
  clearTokenCache,
  supabase,
  type ApiResponse,
  type ApiError,
  type RequestConfig,
} from "./api/http-client";

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
export {
  default as socketClient,
  EnhancedSocketClient,
  type ChatMessage,
  type TypingEvent,
  type UserPresenceEvent,
  type RoomInfo,
  type ConnectionStatus as SocketConnectionStatus,
  type SocketEventHandlers,
} from "./socket/enhanced-socket-client";

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
export {
  // API Hooks
  useProfile,
  useUpdateProfile,
  usePosts,
  usePost,
  useCreatePost,
  useDeletePost,
  useLikePost,
  useComments,
  useAddComment,
  useChatRooms,
  useCreateRoom,
  useHealthCheck,
  useApiQuery,
  useApiMutation,
  type Post,
  type Comment,
  type UserProfile,
  type ChatRoom,
} from "./hooks/use-api";

export {
  useSocket,
  type UseSocketOptions,
  type UseSocketReturn,
} from "./hooks/use-socket";

export {
  useChat,
  type LocalMessage,
  type UseChatOptions,
  type UseChatReturn,
} from "./hooks/use-chat";

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════
export {
  QueryProvider,
  queryKeys,
  staleTime,
} from "./providers/query-provider";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export {
  ErrorBoundary,
  ErrorFallback,
  CommunityErrorBoundary,
  ChatErrorBoundary,
  AuthErrorBoundary,
  InlineError,
  ConnectionStatus,
} from "./components/error-boundary";

export {
  Skeleton,
  PostSkeleton,
  PostListSkeleton,
  FeedSkeleton,
  ChatMessageSkeleton,
  ChatSkeleton,
  ProfileSkeleton,
  DashboardSkeleton,
  RoomItemSkeleton,
  RoomListSkeleton,
  CardSkeleton,
} from "./components/skeletons";

// ═══════════════════════════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════════════════════════
export {
  useUIStore,
  usePreferencesStore,
  useConnectionStore,
  useToast,
} from "./stores/ui-store";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
export { env, getApiUrl, isServer, isClient } from "./config/env";
