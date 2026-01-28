"use client";

/**
 * ENOVA - Skeleton Loading Components
 *
 * Elegant loading placeholders that match the ENOVA design system.
 * Used with Suspense for seamless loading states.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BASE SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

interface SkeletonProps {
  className?: string;
  animated?: boolean;
}

export function Skeleton({ className = "", animated = true }: SkeletonProps) {
  return (
    <div
      className={`bg-gradient-to-r from-purple-100 via-pink-50 to-purple-100 rounded-lg ${animated ? "animate-shimmer" : ""} ${className}`}
      style={{
        backgroundSize: "200% 100%",
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function PostSkeleton() {
  return (
    <article className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-purple-50">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </article>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEED SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function FeedSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Create post skeleton */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>

      {/* Posts */}
      <PostListSkeleton count={3} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatMessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`flex items-end gap-2 max-w-[70%] ${isOwn ? "flex-row-reverse" : ""}`}
      >
        {!isOwn && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
        <div className={`${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && <Skeleton className="h-3 w-20 mb-1" />}
          <Skeleton className={`h-16 ${isOwn ? "w-48" : "w-56"} rounded-2xl`} />
          <Skeleton className="h-2 w-12 mt-1" />
        </div>
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-purple-50/50 to-pink-50/50">
      {/* Header */}
      <div className="p-4 bg-white border-b border-purple-100 flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        <ChatMessageSkeleton />
        <ChatMessageSkeleton isOwn />
        <ChatMessageSkeleton />
        <ChatMessageSkeleton />
        <ChatMessageSkeleton isOwn />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-purple-100">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 flex-1 rounded-full" />
          <Skeleton className="w-12 h-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function ProfileSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
      {/* Banner */}
      <Skeleton className="h-32 w-full rounded-none" />

      {/* Avatar and info */}
      <div className="px-6 pb-6">
        <div className="relative -mt-12 mb-4">
          <Skeleton className="w-24 h-24 rounded-full border-4 border-white" />
        </div>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />

        {/* Stats */}
        <div className="flex gap-6 mt-6 pt-6 border-t border-purple-50">
          <div>
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div>
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div>
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-2xl border border-purple-100"
          >
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 border border-purple-100">
            <Skeleton className="h-6 w-40 mb-4" />
            <PostListSkeleton count={2} />
          </div>
        </div>
        <div>
          <ProfileSkeleton />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM LIST SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function RoomItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-purple-50">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-5 w-5 rounded-full" />
    </div>
  );
}

export function RoomListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <RoomItemSkeleton key={i} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-purple-100 ${className}`}
    >
      <Skeleton className="h-40 w-full rounded-xl mb-4" />
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES (add to globals.css)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add this to globals.css:
 *
 * @keyframes shimmer {
 *   0% { background-position: -200% 0; }
 *   100% { background-position: 200% 0; }
 * }
 *
 * .animate-shimmer {
 *   animation: shimmer 1.5s infinite ease-in-out;
 * }
 */

export default Skeleton;
