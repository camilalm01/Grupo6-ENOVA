'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/services/supabaseClient';
import { useSupabaseUser } from '@/lib/services/useSupabaseUser';

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  image_url: string | null;
  created_at: string;
  profiles?: Profile | null;
};

// Normalize raw DB rows into the Post shape the UI expects.
function normalizePost(raw: any): Post {
  return {
    id: String(raw.id ?? ''),
    user_id: String(raw.user_id ?? ''),
    content: raw.content ?? '',
    tags: Array.isArray(raw.tags)
      ? raw.tags
      : typeof raw.tags === 'string'
        ? raw.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
        : [],
    image_url: raw.image_url ?? null,
    created_at: raw.created_at ?? new Date().toISOString(),
    profiles: raw.profiles
      ? {
        full_name: raw.profiles.full_name ?? null,
        avatar_url: raw.profiles.avatar_url ?? null,
      }
      : null,
  };
}

export default function HomePage() {
  const router = useRouter();
  const { user, loadingUser } = useSupabaseUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  // Redirigir si no está logueada
  useEffect(() => {
    if (!loadingUser && !user) {
      router.push('/login'); // ajusta a tu ruta real
    }
  }, [loadingUser, user, router]);

  // Cargar posts (con JOIN implicito a profiles)
  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(/* ... */)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando posts', error);
        setPosts([]);
      } else if (Array.isArray(data)) {
        const normalized: Post[] = data.map((d) => normalizePost(d));
        setPosts(normalized);
      } else {
        setPosts([]);
      }

      setLoadingPosts(false);
    };

    fetchPosts();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // opcional: limpiar estados extra si tienes
      router.push('/login'); // ajusta si usas otra ruta de login
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    }
  };

  const handleSubmitPost = async () => {
    if (!user || !content.trim()) return;

    setCreating(true);

    const tagsArray = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // 👉 MODO EDITAR
    if (isEditing && editingPostId) {
      const { data, error } = await supabase
        .from('posts')
        .update({
          content,
          tags: tagsArray,
          image_url: imageUrl || null,
        })
        .eq('id', editingPostId)
        .eq('user_id', user.id) // seguridad extra por si acaso
        .select(
          `
        id,
        user_id,
        content,
        tags,
        image_url,
        created_at,
        profiles (
          full_name,
          avatar_url
        )
      `
        )
        .single();

      if (error) {
        console.error('Error actualizando post', error);
      } else if (data) {
        const updated = normalizePost(data);
        setPosts(prev =>
          prev.map(p => (p.id === updated.id ? updated : p))
        );
        // Resetear formulario y modo edición
        setContent('');
        setTags('');
        setImageUrl('');
        setEditingPostId(null);
        setIsEditing(false);
      }

      setCreating(false);
      return;
    }

    // MODO CREAR
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content,
        tags: tagsArray,
        image_url: imageUrl || null,
      })
      .select(
        `
      id,
      user_id,
      content,
      tags,
      image_url,
      created_at,
      profiles (
        full_name,
        avatar_url
      )
    `
      )
      .single();

    if (error) {
      console.error('Error creando post', error);
      if (error.code === '23503') {
        alert('Error: Tu usuario no tiene un perfil asociado. Por favor contacta a soporte o intenta reloguearte.');
      } else {
        alert('Error al crear la publicación. Inténtalo de nuevo.');
      }
    } else if (data) {
      const newPost = normalizePost(data);
      setPosts(prev => [newPost, ...prev]);
      setContent('');
      setTags('');
      setImageUrl('');
    }

    setCreating(false);
  };


  const handleDeletePost = async (postId: string) => {
    const ok = window.confirm('¿Seguro que quieres eliminar esta publicación?');
    if (!ok) return;

    const { error } = await supabase.from('posts').delete().eq('id', postId);

    if (error) {
      console.error('Error eliminando post', error);
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setIsEditing(true);

    // Rellenamos el formulario con los datos del post
    setContent(post.content);
    setTags(post.tags.join(','));
    setImageUrl(post.image_url ?? '');

    // Opcional: hacer scroll al form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const selfProfileName =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    (user.email?.split('@')[0] as string) ||
    'Usuaria';

  return (
    <div className="min-h-screen bg-gradient-radial pb-16 md:pb-0">
      {/* NAVBAR */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              🌸
            </div>
            <span className="font-semibold text-lg text-gray-800">
              ENOVA
            </span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-6 text-sm text-gray-600">
              <button className="font-medium text-purple-600">Inicio</button>
              <button
                onClick={() => router.push('/chat')}
                className="hover:text-purple-600 transition-colors"
              >
                Chat
              </button>
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAvatarMenuOpen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:shadow-lg transition-all"
              >
                {selfProfileName.charAt(0).toUpperCase()}
              </button>

              {isAvatarMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl text-sm z-20 overflow-hidden animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      router.push('/profile');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors"
                  >
                    👤 Mi perfil
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsAvatarMenuOpen(false);
                      await handleLogout();
                    }}
                    className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    👋 Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Form nueva publicación */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold shadow-sm">
              {selfProfileName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <textarea
                className="w-full resize-none rounded-2xl border-2 border-gray-100 px-4 py-3 text-sm focus:outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50 transition-all"
                rows={3}
                placeholder="¿Qué quieres compartir hoy? 💜"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col md:flex-row gap-2 text-xs">
                  <input
                    type="text"
                    className="input py-2 text-sm"
                    placeholder="🏷️ Etiquetas (ej: bienestar, autocuidado)"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input py-2 text-sm"
                    placeholder="🖼️ URL de imagen (opcional)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleSubmitPost}
                  disabled={creating || !content.trim()}
                  className="mt-2 md:mt-0 btn btn-primary px-6 py-2.5 text-sm"
                >
                  {creating
                    ? (isEditing ? 'Guardando...' : 'Publicando...')
                    : (isEditing ? '✨ Guardar cambios' : '💜 Publicar')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feed */}
        {loadingPosts ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Cargando publicaciones…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
            <span className="text-5xl mb-4 block">💜</span>
            <p className="text-gray-600 font-medium">Aún no hay publicaciones</p>
            <p className="text-gray-400 text-sm mt-1">¡Sé la primera en compartir algo!</p>
          </div>
        ) : (
          <section className="space-y-4">
            {posts.map((post) => {
              const isOwner = post.user_id === user.id;
              const profile = post.profiles;
              const name = profile?.full_name || selfProfileName;

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-4 hover:border-purple-100 transition-all animate-fadeIn"
                >
                  {/* Header del post */}
                  <div className="flex justify-between">
                    <div className="flex gap-3">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={name ?? 'Usuaria'}
                          className="w-11 h-11 rounded-full object-cover border-2 border-purple-100"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold shadow-sm">
                          {name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-800">
                          {name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(post.created_at)}
                        </span>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPost(post)}
                          className="text-xs px-3 py-1.5 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                      {post.content}
                    </p>

                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Imagen de la publicación"
                        className="w-full rounded-2xl object-cover max-h-80 border border-gray-100"
                      />
                    )}

                    {post.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="badge"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* Mobile navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-4 py-2 z-10">
        <div className="flex justify-around">
          <button className="flex flex-col items-center text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-xs mt-1">Inicio</span>
          </button>
          <button
            onClick={() => router.push('/chat')}
            className="flex flex-col items-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            <span className="text-xs mt-1">Chat</span>
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <span className="text-xs mt-1">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
