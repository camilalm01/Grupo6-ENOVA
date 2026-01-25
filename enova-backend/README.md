# ENOVA Backend - Microservicios NestJS

Este directorio contiene la arquitectura de microservicios para el backend de
ENOVA, con servicios distribuidos y escalables.

## 🏗️ Arquitectura

```
enova-backend/
├── apps/
│   ├── api-gateway/      # Punto de entrada HTTP, proxy y autenticación
│   ├── auth-service/     # Microservicio de perfiles (TCP)
│   └── chat-service/     # Microservicio de WebSockets (Redis adapter)
│
└── libs/
    └── common/           # Código compartido (interfaces, constantes, decoradores)
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- Docker (para Redis)
- Variables de entorno configuradas

### Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase
```

### Desarrollo

```bash
# Iniciar Redis
docker-compose up -d

# Iniciar todos los servicios
npm run start:all

# O iniciar individualmente:
npm run start:gateway   # Puerto 3000
npm run start:auth      # Puerto 3001 (TCP)
npm run start:chat      # Puerto 3002 (WebSocket)
```

## 📡 Endpoints

### API Gateway (Puerto 3000)

| Método | Ruta                | Descripción                            |
| ------ | ------------------- | -------------------------------------- |
| GET    | `/health`           | Health check (público)                 |
| GET    | `/profile/me`       | Obtener perfil del usuario autenticado |
| GET    | `/profile/:userId`  | Obtener perfil por ID                  |
| POST   | `/profile/me`       | Actualizar perfil propio               |
| GET    | `/validate/:userId` | Validar existencia de usuario          |

### Chat Service (Puerto 3002 - WebSocket)

| Evento            | Dirección          | Descripción            |
| ----------------- | ------------------ | ---------------------- |
| `join_room`       | Cliente → Servidor | Unirse a una sala      |
| `leave_room`      | Cliente → Servidor | Salir de una sala      |
| `send_message`    | Cliente → Servidor | Enviar mensaje         |
| `typing`          | Cliente → Servidor | Indicador de escritura |
| `receive_message` | Servidor → Cliente | Nuevo mensaje recibido |
| `chat_history`    | Servidor → Cliente | Historial de mensajes  |
| `user_joined`     | Servidor → Cliente | Usuario se unió        |
| `user_left`       | Servidor → Cliente | Usuario salió          |
| `user_typing`     | Servidor → Cliente | Usuario escribiendo    |

## 🔐 Autenticación

El API Gateway valida tokens JWT de Supabase automáticamente. Para rutas
públicas, usar el decorador `@Public()`.

```typescript
import { Public } from './guards/supabase-auth.guard';

@Public()
@Get('health')
getHealth() {
  return { status: 'ok' };
}
```

## 🔄 Comunicación Inter-servicios

La comunicación entre Gateway y Auth Service usa TCP con
`@nestjs/microservices`:

```typescript
// En el Gateway
@Inject('AUTH_SERVICE') private readonly authClient: ClientProxy

// Enviar mensaje
this.authClient.send({ cmd: 'get_profile' }, { userId });
```

## 📦 Escalabilidad

El Chat Service usa Redis Adapter para Socket.io, permitiendo múltiples
instancias:

```bash
# Escalar el chat service
docker-compose up -d --scale chat-service=3
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# Coverage
npm run test:cov
```

## 📝 Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.
