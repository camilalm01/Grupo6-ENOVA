# ENOVA - Plataforma de Acogida Femenina

Bienvenida al repositorio de **ENOVA**, una plataforma digital diseñada para
empoderar a las mujeres, ofreciendo un espacio seguro de comunidad, apoyo y
recursos. Este proyecto es desarrollado por el **Grupo 6**.

## 🏗️ Arquitectura

ENOVA utiliza una **arquitectura de microservicios** con los siguientes
componentes:

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                   Next.js 16 (React 19)                     │
│                     Puerto: 3001                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY                             │
│           NestJS + Rate Limiting + Circuit Breaker          │
│                     Puerto: 3000                            │
└─────────────────────────────────────────────────────────────┘
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │   Auth   │   │  Chat    │   │Community │
       │ Service  │   │ Service  │   │ Service  │
       │  :3001   │   │  :3002   │   │  :3003   │
       └──────────┘   └──────────┘   └──────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │    Supabase     │
                    │  (PostgreSQL)   │
                    └─────────────────┘
```

## 🌟 Características Principales

### 💬 Chat de Apoyo en Tiempo Real

- **Comunicación Instantánea:** Chat fluido impulsado por **Socket.io**
- **Optimistic UI:** Mensajes aparecen instantáneamente
- **Persistencia:** Historial guardado en **Supabase**
- **Indicadores de Estado:** Estado de conexión y "escribiendo..."

### 📰 Dashboard y Feed Comunitario

- **Publicaciones:** Compartir pensamientos, recursos y experiencias
- **Perfiles de Usuario:** Integración con perfiles (nombre, avatar)
- **Gestión de Contenido:** Crear, editar y eliminar publicaciones
- **Etiquetas e Imágenes:** Categorización y adjuntos

### 🔐 Autenticación y Seguridad

- **Supabase Auth:** Sistema robusto de registro e inicio de sesión
- **JWT Validation:** Validación de tokens con JWKS
- **Row Level Security (RLS):** Políticas en base de datos
- **Rate Limiting:** Protección contra abuso de API
- **Circuit Breaker:** Resiliencia ante fallos de servicios

## 🚀 Tecnologías

| Componente     | Tecnología                       |
| -------------- | -------------------------------- |
| Frontend       | Next.js 16, React 19, TypeScript |
| Estilos        | Tailwind CSS 4                   |
| API Gateway    | NestJS, @nestjs/throttler        |
| Microservicios | NestJS, TCP Transport            |
| Base de Datos  | Supabase (PostgreSQL)            |
| Real-time      | Socket.io                        |
| Mensajería     | RabbitMQ (eventos async)         |
| Cache          | Redis (Socket.io adapter)        |

## 📋 Requisitos Previos

- **Node.js**: Versión 20 o superior
- **Cuenta de Supabase**: Para base de datos y autenticación
- **Docker** (opcional): Para RabbitMQ y Redis

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd Grupo6-ENOVA
```

### 2. Instalar dependencias

```bash
# Frontend
npm install

# Backend
cd enova-backend
npm install
```

### 3. Configurar variables de entorno

**Frontend** (`.env.local` en raíz):

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Backend** (`enova-backend/.env`):

```env
# Ver enova-backend/.env.example para todas las variables
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role
SUPABASE_JWT_SECRET=tu-jwt-secret
```

## 🏃 Ejecución

### Opción 1: Desarrollo Rápido (Frontend + Chat integrado)

```bash
npm run dev:chat
```

- Frontend + Socket.io en `http://localhost:3000`

### Opción 2: Arquitectura Completa (Microservicios)

```bash
# Terminal 1: API Gateway
cd enova-backend
npm run start:gateway

# Terminal 2: Frontend
npm run dev
```

- Gateway en `http://localhost:3000`
- Frontend en `http://localhost:3001`

## 📁 Estructura del Proyecto

```
Grupo6-ENOVA/
├── app/                    # Frontend Next.js (App Router)
│   ├── chat/              # Módulo de Chat
│   ├── dashboard/         # Feed y publicaciones
│   ├── login/             # Autenticación
│   └── profile/           # Perfil de usuario
├── lib/                    # Utilidades frontend
│   ├── services/          # Clientes Supabase
│   ├── api-client.ts      # Cliente HTTP para Gateway
│   └── socket-client.ts   # Cliente Socket.io
├── enova-backend/          # Backend (Microservicios)
│   ├── apps/
│   │   ├── api-gateway/   # Gateway principal
│   │   ├── auth-service/  # Servicio de autenticación
│   │   ├── chat-service/  # Servicio de chat
│   │   └── community-service/ # Servicio de comunidad
│   └── libs/              # Librerías compartidas
├── docker/                 # Configuración Docker
└── k8s/                    # Manifiestos Kubernetes
```

## 🧪 Testing

```bash
# Backend tests
cd enova-backend
npm run test

# E2E tests
npm run test:e2e
```

## 👥 Equipo

**Grupo 6 - ENOVA**\
Desarrollo de Software Seguro y Escalable

---

_Construido con 💜 para la comunidad._
