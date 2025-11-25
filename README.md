# Plataforma de Autonomía Femenina (ENOVA)

Bienvenida al repositorio de **ENOVA**, una plataforma digital diseñada para empoderar a las mujeres, ofreciendo un espacio seguro de comunidad, apoyo y recursos. Este proyecto es desarrollado por el **Grupo 6**.

## 🌟 Características Principales

### 💬 Chat de Apoyo en Tiempo Real
- **Comunicación Instantánea:** Chat fluido y rápido impulsado por **Socket.io**.
- **Optimistic UI:** Los mensajes aparecen instantáneamente al enviarse, mejorando la percepción de velocidad.
- **Persistencia:** Historial de mensajes guardado de forma segura en **Supabase**.
- **Indicadores de Estado:** Visualización de estado de conexión y notificación de "escribiendo...".
- **Diseño Inclusivo:** Interfaz amigable con tonos violetas y lilas, priorizando la accesibilidad.

### 📰 Dashboard y Feed Comunitario
- **Publicaciones:** Las usuarias pueden compartir pensamientos, recursos y experiencias.
- **Perfiles de Usuario:** Integración automática con perfiles de usuario (nombre, avatar).
- **Gestión de Contenido:** Capacidad para crear, editar y eliminar publicaciones propias.
- **Etiquetas e Imágenes:** Soporte para categorizar posts y adjuntar imágenes.

### 🔐 Autenticación y Seguridad
- **Supabase Auth:** Sistema robusto de registro e inicio de sesión.
- **Row Level Security (RLS):** Políticas de seguridad en base de datos para garantizar que cada usuaria solo acceda a lo que le corresponde.
- **Protección de Rutas:** Middleware y verificaciones de sesión para proteger áreas privadas.

## 🚀 Tecnologías Utilizadas

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), React 19.
- **Lenguaje:** TypeScript.
- **Estilos:** Tailwind CSS 4.
- **Backend / Base de Datos:** Supabase (PostgreSQL, Auth, Storage).
- **Servidor Real-time:** Custom Server con Node.js + Socket.io (integrado con Next.js).

## 📋 Requisitos Previos

- **Node.js**: Versión 18 o superior.
- **Cuenta de Supabase**: Para la base de datos y autenticación.

## 🛠️ Instalación y Configuración

1.  **Clonar el repositorio:**

    ```bash
    git clone <url-del-repo>
    cd Grupo6-ENOVA
    ```

2.  **Instalar dependencias:**

    ```bash
    npm install
    ```

3.  **Configurar variables de entorno:**

    Crea un archivo `.env.local` en la raíz del proyecto y añade tus credenciales de Supabase:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica-anon
    SUPABASE_SERVICE_ROLE_KEY=tu-clave-secreta-service-role
    PORT=3000
    ```

    > **Nota:** La `SUPABASE_SERVICE_ROLE_KEY` es necesaria para que el servidor de Socket.io pueda guardar mensajes en la base de datos sin restricciones de RLS del lado del servidor.

4.  **Configurar la Base de Datos:**

    Ejecuta el script de migración en el **SQL Editor** de tu dashboard de Supabase. Este script crea:
    - Tablas: `profiles`, `posts`, `chat_messages`.
    - Triggers: Para creación automática de perfiles y actualización de fechas.
    - Políticas RLS: Para seguridad de datos.

    *(Si tienes usuarios existentes sin perfil, asegúrate de ejecutar el script de backfill).*

## 🏃‍♂️ Ejecución

### Modo Desarrollo

Para levantar el servidor de desarrollo (que incluye tanto Next.js como el servidor de WebSockets):

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Modo Producción

Para compilar y ejecutar en producción:

```bash
npm run build
npm run start:prod
```

## 📁 Estructura del Proyecto

```
/
├── app/                 # Rutas y páginas de Next.js (App Router)
│   ├── chat/            # Módulo de Chat (Page + Componente ChatRoom)
│   ├── dashboard/       # Feed principal y lógica de posts
│   ├── login/           # Página de inicio de sesión
│   └── ...
├── lib/                 # Utilidades y lógica de negocio
│   ├── services/        # Clientes de Supabase y servicios de datos
│   └── socket/          # Manejadores de eventos de Socket.io (Backend)
├── database/            # Scripts SQL de referencia
├── public/              # Archivos estáticos
├── server.ts            # Entry point del servidor custom (Next + Socket.io)
└── ...
```

## 👥 Equipo

- **Grupo 6 - ENOVA**
- Desarrollo de Software Seguro y Escalable.

---
*Construido con 💜 para la comunidad.*
