# Plataforma de Autonomía Femenina - Módulo de Chat

Este proyecto es parte de la **Plataforma de Autonomía Femenina** (Grupo 6 ENOVA). Es un módulo de chat en tiempo real diseñado para ofrecer un espacio seguro de apoyo.

## 🚀 Tecnologías

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Lenguaje**: TypeScript
- **Tiempo Real**: Socket.io
- **Base de Datos**: Supabase (PostgreSQL)
- **Estilos**: Tailwind CSS
- **Servidor**: Custom Server (Node.js + Next.js + Socket.io)

## 📋 Requisitos Previos

- Node.js 18+
- Cuenta en Supabase

## 🛠️ Instalación y Configuración

1. **Clonar el repositorio e instalar dependencias:**

```bash
npm install
```

2. **Configurar variables de entorno:**

Crea un archivo `.env.local` basado en el ejemplo:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica
SUPABASE_SERVICE_ROLE_KEY=tu-clave-de-servicio
```

3. **Configurar la Base de Datos:**

Ejecuta el script SQL ubicado en `database/chat_schema.sql` en el editor SQL de tu dashboard de Supabase.

## 🏃‍♂️ Ejecución

### Desarrollo

```bash
npm run dev
```
El servidor iniciará en `http://localhost:3000`.

### Producción

```bash
npm run build
npm run start:prod
```

## 📁 Estructura del Proyecto

- `/app`: Páginas y componentes de Next.js (App Router)
  - `/chat`: Componente principal del chat (`ChatRoom.tsx`) y página (`page.tsx`)
- `/lib`: Lógica de negocio y utilidades
  - `/services`: Servicios de Supabase (`chatService.ts`)
  - `/socket`: Manejadores de eventos de Socket.io (`socketHandler.ts`)
- `/database`: Scripts SQL para la base de datos
- `server.ts`: Servidor personalizado que integra Next.js y Socket.io

## 🧪 Características del Chat

- **Tiempo Real**: Mensajería instantánea con Socket.io.
- **Persistencia**: Historial de mensajes guardado en Supabase.
- **Indicadores**: Estado de conexión ("En línea") y "Escribiendo...".
- **Diseño**: Interfaz moderna y responsive con tema violeta/lila.
- **Seguridad**: Validación de mensajes y manejo de errores.

## 📝 Licencia

Este proyecto es privado y pertenece al Grupo 6 ENOVA.
