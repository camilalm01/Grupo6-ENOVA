# 📋 Manual de Pruebas - ENOVA Microservicios

## Información General

| Elemento     | Valor                                  |
| ------------ | -------------------------------------- |
| **Proyecto** | ENOVA - Plataforma de Acogida Femenina |
| **Versión**  | 2.0 (Microservicios)                   |
| **Fecha**    | Enero 2026                             |
| **Autor**    | QA Team - Grupo 6                      |

---

## 1. Validación de la Ruta Crítica de la Usuaria

### 1.1 Flujo de Registro/Login

| Paso | Acción                                  | Resultado Esperado                        | ✅/❌ |
| ---- | --------------------------------------- | ----------------------------------------- | ----- |
| 1    | Navegar a `http://localhost:3000/login` | Página de login carga correctamente       |       |
| 2    | Click en "Crear cuenta"                 | Redirige a `/auth/registro`               |       |
| 3    | Llenar formulario con datos válidos     | Campos aceptan input sin errores          |       |
| 4    | Click en "Crear mi cuenta"              | Registro exitoso, redirección a dashboard |       |
| 5    | Cerrar sesión y volver a login          | Página de login visible                   |       |
| 6    | Ingresar credenciales registradas       | Login exitoso, dashboard cargado          |       |
| 7    | Verificar nombre de usuario en header   | Nombre correcto visible                   |       |

#### Verificación Técnica (Network Tab)

```
1. Abrir DevTools (F12) > Network
2. Filtrar por "Fetch/XHR"
3. Al hacer login, verificar:
   - Request a Supabase Auth: supabase.co/auth/v1/token
   - Response: 200 OK con access_token
   - NO debe haber requests a /api/* del Next.js server
```

---

### 1.2 Feed de Comunidad (CRUD de Posts)

#### Crear Post

| Paso | Acción                                    | Resultado Esperado                          | ✅/❌ |
| ---- | ----------------------------------------- | ------------------------------------------- | ----- |
| 1    | Navegar al Dashboard                      | Feed visible con formulario de publicación  |       |
| 2    | Escribir contenido en textarea            | Texto ingresado correctamente               |       |
| 3    | Añadir etiquetas (ej: "bienestar, apoyo") | Tags separados por comas aceptados          |       |
| 4    | Click en "💜 Publicar"                    | Post aparece instantáneamente en el feed    |       |
| 5    | Verificar timestamp                       | Muestra "hace unos segundos" o fecha actual |       |

#### Editar Post

| Paso | Acción                        | Resultado Esperado                         | ✅/❌ |
| ---- | ----------------------------- | ------------------------------------------ | ----- |
| 1    | Localizar post propio         | Botones "Editar" y "Eliminar" visibles     |       |
| 2    | Click en "✏️ Editar"          | Formulario se rellena con contenido actual |       |
| 3    | Modificar texto               | Cambios reflejados en textarea             |       |
| 4    | Click en "✨ Guardar cambios" | Post actualizado en feed                   |       |
| 5    | Recargar página (F5)          | Cambios persisten tras recarga             |       |

#### Eliminar Post

| Paso | Acción                 | Resultado Esperado                 | ✅/❌ |
| ---- | ---------------------- | ---------------------------------- | ----- |
| 1    | Localizar post propio  | Botón "🗑️ Eliminar" visible        |       |
| 2    | Click en "🗑️ Eliminar" | Confirmación aparece (alert/modal) |       |
| 3    | Confirmar eliminación  | Post desaparece del feed           |       |
| 4    | Recargar página        | Post NO reaparece                  |       |

---

### 1.3 Chat en Tiempo Real (Multi-Usuario)

#### Preparación

- Abrir DOS ventanas de navegador (o modo incógnito)
- Usuario A: jahito808@gmail.com
- Usuario B: (crear cuenta de prueba o usar otra existente)

#### Prueba de Mensajería

| Paso | Usuario | Acción                         | Resultado Esperado                      | ✅/❌ |
| ---- | ------- | ------------------------------ | --------------------------------------- | ----- |
| 1    | A       | Navegar a `/chat`              | Chat carga, estado "Conectada" (verde)  |       |
| 2    | B       | Navegar a `/chat`              | Chat carga, estado "Conectada" (verde)  |       |
| 3    | A       | Escribir en input (sin enviar) | -                                       |       |
| 4    | B       | Observar pantalla              | "Usuario A está escribiendo..." visible |       |
| 5    | A       | Enviar mensaje "Hola desde A"  | Mensaje aparece instantáneamente        |       |
| 6    | B       | Verificar recepción            | Mensaje de A visible en < 1 segundo     |       |
| 7    | B       | Responder "Hola desde B"       | Mensaje enviado                         |       |
| 8    | A       | Verificar recepción            | Mensaje de B visible en < 1 segundo     |       |
| 9    | A       | Recargar página                | Historial de mensajes cargado           |       |

#### Verificación de WebSocket (Network Tab)

```
1. DevTools > Network > WS (WebSocket)
2. Verificar conexión a: ws://localhost:3000/socket.io
3. Mensajes deben mostrar eventos:
   - join_room
   - send_message
   - receive_message
   - typing
```

---

## 2. Verificación de la Separación de Servicios

### 2.1 Inspección de Tráfico (Network Tab)

#### Checklist de Requests

| Request      | URL Esperada                      | Servicio          |
| ------------ | --------------------------------- | ----------------- |
| Login        | `supabase.co/auth/v1/*`           | Supabase Auth     |
| Cargar Posts | `localhost:3000/posts` o Supabase | Gateway/Community |
| Crear Post   | `supabase.co/rest/v1/posts`       | Supabase DB       |
| WebSocket    | `ws://localhost:3000/socket.io`   | Chat Service      |

#### Requests que NO deben existir

- ❌ `/api/auth/*` (rutas internas de Next.js)
- ❌ `/api/posts/*` (rutas internas de Next.js)
- ❌ Requests directos a puertos internos (3001, 3002, 3003)

### 2.2 Persistencia Distribuida

#### Verificación en Supabase Dashboard

1. **Tabla `posts`**: Crear un post y verificar que aparece
2. **Tabla `chat_messages`**: Enviar un mensaje y verificar que aparece
3. **Verificar aislamiento**:
   - Un mensaje de chat NO debe aparecer en `posts`
   - Un post NO debe aparecer en `chat_messages`

---

## 3. Prueba de Resiliencia (Chaos Engineering Lite)

### 3.1 Simular Caída del Servicio de Comunidad

#### Procedimiento

```bash
# Terminal: Detener el Community Service manualmente
# (Si está en contenedor)
docker stop community-service

# O si es proceso local
kill -9 $(lsof -t -i:3003)
```

#### Verificación

| Escenario             | Resultado Esperado                               | ✅/❌ |
| --------------------- | ------------------------------------------------ | ----- |
| Dashboard (Feed)      | Muestra error o mensaje "Servicio no disponible" |       |
| Chat                  | Sigue funcionando normalmente                    |       |
| Indicador "Conectada" | Permanece verde                                  |       |
| Enviar mensaje        | Se envía y recibe correctamente                  |       |

#### Restauración

```bash
# Reiniciar el servicio
docker start community-service
# O
npm run start:community
```

---

## 4. Verificación de Observabilidad

### 4.1 Métricas en Grafana

| Métrica            | Panel              | Valor Esperado                  |
| ------------------ | ------------------ | ------------------------------- |
| Request Rate       | Gateway Requests/s | > 0 durante pruebas             |
| Error Rate         | Gateway Errors     | < 1%                            |
| Latency P95        | Gateway Latency    | < 500ms                         |
| Active Connections | Chat Connections   | = Número de usuarios conectados |

### 4.2 Trazas en Jaeger

#### Verificar Traza Completa

1. Abrir Jaeger UI (`http://localhost:16686`)
2. Seleccionar servicio: `api-gateway`
3. Buscar operación: `POST /posts`
4. Verificar que la traza muestra:
   - `api-gateway` → `community-service` → `supabase`

---

## 5. Resultados de Prueba

### Resumen Ejecutivo

| Categoría      | Total  | Pasadas | Falladas |
| -------------- | ------ | ------- | -------- |
| Login/Registro | 7      | _       | _        |
| Feed CRUD      | 14     | _       | _        |
| Chat Real-time | 9      | _       | _        |
| Resiliencia    | 4      | _       | _        |
| Observabilidad | 4      | _       | _        |
| **TOTAL**      | **38** | _       | _        |

### Notas del Tester

```
Fecha: _______________
Tester: _______________
Ambiente: [ ] Desarrollo  [ ] Staging  [ ] Producción

Observaciones:
_________________________________________________________
_________________________________________________________
_________________________________________________________
```

---

## Apéndice: Credenciales de Prueba

| Usuario   | Email               | Contraseña | Rol               |
| --------- | ------------------- | ---------- | ----------------- |
| Usuario A | jahito808@gmail.com | 12345678   | Tester Principal  |
| Usuario B | (crear)             | (crear)    | Tester Secundario |
