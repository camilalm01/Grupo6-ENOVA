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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Verificando sesión…</p>
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
    <div className="min-h-screen bg-gray-100">
      {/* NAVBAR */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
              AF
            </div>
            <span className="font-semibold text-lg text-gray-800">
              Plataforma de Autonomía Femenina
            </span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-6 text-sm text-gray-600">
              <button className="font-medium text-purple-600">Inicio</button>
              <button
                onClick={() => router.push('/chat')} // 👈 ajusta a la ruta real de tu chat
                className="hover:text-purple-600"
              >
                Chat
              </button>
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAvatarMenuOpen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:bg-purple-600 transition"
              >
                {selfProfileName.charAt(0).toUpperCase()}
              </button>

              {isAvatarMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg text-sm z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      router.push('/profile');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-t-xl"
                  >
                    Mi perfil
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsAvatarMenuOpen(false);
                      await handleLogout();
                    }}
                    className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-b-xl"
                  >
                    Cerrar sesión
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
        <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-300 flex items-center justify-center text-white font-semibold">
              {selfProfileName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <textarea
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                rows={3}
                placeholder="¿Qué quieres compartir hoy?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col md:flex-row gap-2 text-xs">
                  <input
                    type="text"
                    className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    placeholder="Etiquetas (ej: bienestar,autocuidado)"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <input
                    type="text"
                    className="border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    placeholder="URL de imagen (opcional)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleSubmitPost}
                  disabled={creating || !content.trim()}
                  className="mt-2 md:mt-0 inline-flex items-center justify-center rounded-full bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {creating
                    ? (isEditing ? 'Guardando cambios…' : 'Publicando…')
                    : (isEditing ? 'Guardar cambios' : 'Publicar')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feed */}
        {loadingPosts ? (
          <p className="text-center text-gray-500 text-sm">
            Cargando publicaciones…
          </p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500 text-sm">
            Aún no hay publicaciones. ¡Sé la primera en compartir algo! 💜
          </p>
        ) : (
          <section className="space-y-4">
            {posts.map((post) => {
              const isOwner = post.user_id === user.id;
              const profile = post.profiles;
              const name =
                profile?.full_name ||
                selfProfileName; // si aún no tienes join bien hecho

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl shadow-sm p-4 space-y-3"
                >
                  {/* Header del post */}
                  <div className="flex justify-between">
                    <div className="flex gap-3">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={name ?? 'Usuaria'}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-300 flex items-center justify-center text-white font-semibold">
                          {name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(post.created_at)}
                        </span>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPost(post)}
                          className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-xs px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {post.content}
                    </p>

                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Imagen de la publicación"
                        className="mt-2 w-full rounded-xl object-cover max-h-80"
                      />
                    )}

                    {post.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-purple-100 px-3 py-0.5 text-xs font-medium text-purple-700"
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
    </div>
  );
}
