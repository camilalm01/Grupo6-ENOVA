# 🔥 Guía de Chaos Engineering - ENOVA

## Objetivo

Verificar que la arquitectura de microservicios de ENOVA es **resiliente** ante
fallos parciales, demostrando que los servicios son verdaderamente
independientes.

---

## Principios de Chaos Engineering

1. **Hipótesis sobre el estado estable**: Definir el comportamiento normal
2. **Variar eventos del mundo real**: Simular fallos reales
3. **Ejecutar experimentos en producción**: (con cuidado)
4. **Automatizar para ejecutar continuamente**: CI/CD integration
5. **Minimizar el radio de explosión**: Limitar el impacto

---

## Experimentos de Resiliencia

### Experimento 1: Caída del Community Service

**Hipótesis**: Si el servicio de comunidad falla, el chat debe seguir
funcionando.

#### Procedimiento Local (Docker)

```bash
# 1. Verificar estado inicial
docker ps | grep community

# 2. Detener el servicio
docker stop community-service

# 3. Ejecutar pruebas de chat
# - Abrir http://localhost:3000/chat
# - Verificar indicador "Conectada" = verde
# - Enviar mensajes
# - Verificar recepción

# 4. Verificar que el feed muestra error graceful
# - Navegar a /dashboard
# - Debe mostrar mensaje de error, no crash

# 5. Restaurar servicio
docker start community-service
```

#### Procedimiento Kubernetes

```bash
# 1. Escalar a 0 réplicas
kubectl scale deployment community-service --replicas=0

# 2. Verificar pods
kubectl get pods -l app=community-service

# 3. Ejecutar pruebas...

# 4. Restaurar
kubectl scale deployment community-service --replicas=3
```

#### Criterios de Éxito

| Criterio                               | Estado            |
| -------------------------------------- | ----------------- |
| Chat mantiene conexión WebSocket       | ⬜ Pass / ⬜ Fail |
| Mensajes se envían/reciben normalmente | ⬜ Pass / ⬜ Fail |
| Dashboard muestra error graceful       | ⬜ Pass / ⬜ Fail |
| No hay crash de la aplicación          | ⬜ Pass / ⬜ Fail |

---

### Experimento 2: Caída del Chat Service

**Hipótesis**: Si el servicio de chat falla, el feed debe seguir funcionando.

#### Procedimiento

```bash
# 1. Detener Chat Service
docker stop chat-service
# o
kubectl scale deployment chat-service --replicas=0

# 2. Verificar Dashboard
# - Crear post
# - Editar post
# - Eliminar post

# 3. Verificar Chat
# - Debe mostrar "Desconectada" (rojo)
# - Debe intentar reconectar automáticamente

# 4. Restaurar
docker start chat-service
```

#### Criterios de Éxito

| Criterio                           | Estado            |
| ---------------------------------- | ----------------- |
| Feed sigue funcionando             | ⬜ Pass / ⬜ Fail |
| CRUD de posts opera normalmente    | ⬜ Pass / ⬜ Fail |
| Chat muestra estado desconectado   | ⬜ Pass / ⬜ Fail |
| Reconexión automática al restaurar | ⬜ Pass / ⬜ Fail |

---

### Experimento 3: Latencia de Red

**Hipótesis**: El sistema debe manejar latencia alta sin timeouts frecuentes.

#### Usando tc (Traffic Control)

```bash
# Añadir latencia de 500ms a todas las conexiones
sudo tc qdisc add dev lo root netem delay 500ms

# Ejecutar pruebas normales...

# Remover latencia
sudo tc qdisc del dev lo root
```

#### Usando Toxiproxy (Recomendado)

```bash
# Crear proxy con latencia
toxiproxy-cli create community_latency -l localhost:13000 -u localhost:3003
toxiproxy-cli toxic add community_latency -t latency -a latency=1000

# Ejecutar pruebas...

# Remover
toxiproxy-cli toxic remove community_latency -n latency_downstream
```

#### Criterios de Éxito

| Criterio        | Latencia 500ms | Latencia 1s |
| --------------- | -------------- | ----------- |
| Páginas cargan  | ⬜ Pass        | ⬜ Pass     |
| No hay timeouts | ⬜ Pass        | ⬜ Pass     |
| UX aceptable    | ⬜ Pass        | ⬜ Pass     |

---

### Experimento 4: Caída de Redis (Chat Adapter)

**Hipótesis**: Si Redis falla, el chat debe degradar gracefully a
single-instance.

#### Procedimiento

```bash
# 1. Detener Redis
docker stop redis
# o
kubectl scale deployment redis --replicas=0

# 2. Verificar Chat
# - Conexiones existentes deben mantenerse
# - Nuevas conexiones deben funcionar (modo degradado)
# - Mensajes pueden no sincronizar entre instancias

# 3. Restaurar
docker start redis
```

#### Criterios de Éxito

| Criterio                                   | Estado            |
| ------------------------------------------ | ----------------- |
| Chat sigue funcionando (single instance)   | ⬜ Pass / ⬜ Fail |
| Logs indican modo degradado                | ⬜ Pass / ⬜ Fail |
| Recuperación automática al restaurar Redis | ⬜ Pass / ⬜ Fail |

---

### Experimento 5: Circuit Breaker Test

**Hipótesis**: Después de múltiples fallos, el circuit breaker debe abrirse.

#### Procedimiento

```bash
# 1. Simular servicio inestable (50% error rate)
# Modificar temporalmente el servicio para fallar:
# - En auth-service, añadir random failures

# 2. Generar tráfico
ab -n 1000 -c 10 http://localhost:3000/profile/me

# 3. Verificar estado del circuit
curl http://localhost:3000/circuits/status

# 4. El circuit debe estar "OPEN" después de umbral de errores
```

#### Estados del Circuit Breaker

| Estado    | Descripción                           |
| --------- | ------------------------------------- |
| CLOSED    | Normal - requests pasan               |
| OPEN      | Fallo detectado - requests bloqueados |
| HALF-OPEN | Probando recuperación                 |

---

## Herramientas de Chaos Engineering

### Locales

| Herramienta            | Uso                            |
| ---------------------- | ------------------------------ |
| `docker stop/start`    | Simular caída de servicios     |
| `tc` (Traffic Control) | Latencia/pérdida de paquetes   |
| `toxiproxy`            | Proxy con fallos configurables |
| `stress-ng`            | Stress de CPU/memoria          |

### Kubernetes

| Herramienta | Uso                        |
| ----------- | -------------------------- |
| Chaos Mesh  | Platform completa de chaos |
| LitmusChaos | Experimentos declarativos  |
| Gremlin     | SaaS de chaos engineering  |

### Instalación de Chaos Mesh (K8s)

```bash
# Instalar Chaos Mesh
kubectl apply -f https://raw.githubusercontent.com/chaos-mesh/chaos-mesh/master/manifests/crd.yaml

helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh --namespace=chaos-testing --create-namespace
```

---

## Template de Experimento

```markdown
## Experimento: [Nombre]

### Hipótesis

[Qué esperas que suceda]

### Estado Estable

[Métricas normales del sistema]

### Método

[Pasos para introducir el caos]

### Observación

[Qué métricas monitorear]

### Rollback

[Cómo restaurar el estado normal]

### Resultados

| Métrica | Antes | Durante | Después |
| ------- | ----- | ------- | ------- |
| [x]     |       |         |         |

### Conclusión

[Pasó/Falló + acciones a tomar]
```

---

## Automatización en CI/CD

### GitHub Actions Example

```yaml
name: Chaos Tests

on:
    schedule:
        - cron: "0 2 * * *" # Daily at 2 AM

jobs:
    chaos:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - name: Deploy to Staging
              run: ./scripts/deploy-staging.sh

            - name: Run Chaos Experiment
              run: |
                  # Kill community service
                  kubectl scale deployment community-service --replicas=0
                  sleep 30

                  # Verify chat still works
                  npm run test:e2e -- --grep "chat"

                  # Restore
                  kubectl scale deployment community-service --replicas=3

            - name: Report Results
              if: always()
              run: ./scripts/report-chaos-results.sh
```

---

## Checklist Pre-Producción

| Experimento               | Probado | Resultado |
| ------------------------- | ------- | --------- |
| Caída Community Service   | ⬜      |           |
| Caída Chat Service        | ⬜      |           |
| Latencia 500ms            | ⬜      |           |
| Caída Redis               | ⬜      |           |
| Circuit Breaker           | ⬜      |           |
| Caída Supabase (simulada) | ⬜      |           |

**Firma QA:** ________________\
**Fecha:** ________________
