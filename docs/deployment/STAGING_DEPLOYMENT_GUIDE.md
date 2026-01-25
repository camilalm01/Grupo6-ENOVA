# 🚀 Guía de Despliegue a Staging y Producción

## Visión General

Este documento describe el proceso completo de despliegue de ENOVA a Staging y
Producción, incluyendo la estrategia de Canary Deployment y monitoreo de Golden
Signals.

---

## 1. Arquitectura de Despliegue

```
     ┌──────────────────────────────────────────┐
     │           INGRESS CONTROLLER             │
     │        (nginx-ingress + canary)          │
     └─────────────────┬────────────────────────┘
                       │
     ┌─────────────────┼─────────────────┐
     │                 │                 │
┌────▼────┐      ┌─────▼─────┐     ┌────▼────┐
│ Frontend│      │  Gateway  │     │   Chat  │
│  (NEW)  │      │   (NEW)   │     │  (NEW)  │
│   10%   │      │    10%    │     │  100%   │
└─────────┘      └───────────┘     └─────────┘
     │                 │
┌────▼────┐      ┌─────▼─────┐
│ Frontend│      │  Gateway  │
│ (LEGACY)│      │  (LEGACY) │
│   90%   │      │    90%    │
└─────────┘      └───────────┘
```

---

## 2. Preparación del Entorno Staging

### 2.1 Variables de Entorno

Crear ConfigMap y Secrets:

```bash
# Crear namespace
kubectl create namespace enova-staging

# Crear secrets
kubectl create secret generic supabase-credentials \
  --namespace=enova-staging \
  --from-literal=SUPABASE_URL="https://tu-proyecto.supabase.co" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="tu-key" \
  --from-literal=SUPABASE_JWT_SECRET="tu-jwt-secret"

# Verificar
kubectl get secrets -n enova-staging
```

### 2.2 Desplegar Infraestructura Base

```bash
# Aplicar manifiestos
kubectl apply -f k8s/staging/ -n enova-staging

# Verificar pods
kubectl get pods -n enova-staging

# Verificar servicios
kubectl get svc -n enova-staging
```

---

## 3. Estrategia de Canary Deployment

### 3.1 Fase 1: 10% del Tráfico (Canary)

```bash
# Aplicar configuración canary inicial
kubectl apply -f k8s/ingress-canary-10.yaml

# Verificar anotaciones
kubectl describe ingress enova-canary -n enova-staging
```

### 3.2 Monitoreo Durante Canary

Observar durante **30 minutos** antes de proceder:

| Métrica       | Umbral Aceptable | Acción si Excede |
| ------------- | ---------------- | ---------------- |
| Error Rate    | < 1%             | Rollback         |
| P95 Latency   | < 500ms          | Investigar       |
| 5xx Responses | < 0.1%           | Rollback         |

### 3.3 Fase 2: 50% del Tráfico

```bash
# Solo si métricas son estables
kubectl apply -f k8s/ingress-canary-50.yaml

# Monitorear 15 minutos adicionales
```

### 3.4 Fase 3: 100% del Tráfico

```bash
# Migración completa
kubectl apply -f k8s/ingress-canary-100.yaml

# Eliminar Ingress legacy
kubectl delete ingress enova-legacy -n enova-staging
```

### 3.5 Rollback de Emergencia

```bash
# Si algo falla - volver instantáneamente al monolito
kubectl apply -f k8s/ingress-rollback.yaml

# Verificar que tráfico va al legacy
kubectl logs -f -l app=nginx-ingress -n ingress-nginx
```

---

## 4. Ejecutar Stress Tests en Staging

### 4.1 Configurar URL de Staging

```bash
export STAGING_URL="https://staging.enova.example.com"
```

### 4.2 Ejecutar K6

```bash
# Instalar K6 si no está
brew install k6  # Mac
# o
sudo apt install k6  # Ubuntu

# Ejecutar stress test contra Staging
k6 run \
  -e BASE_URL=$STAGING_URL \
  -e WS_URL="wss://staging.enova.example.com" \
  docs/testing/stress-test.js
```

### 4.3 Interpretar Resultados

```
╔══════════════════════════════════════════════════════════════╗
║              ENOVA STRESS TEST RESULTS                       ║
╠══════════════════════════════════════════════════════════════╣
║ HTTP Requests                                                ║
║   Total: 5000                                                ║
║   Failed: 0.5%  ✅ (< 1%)                                    ║
║   Duration (p95): 450ms  ✅ (< 2000ms)                       ║
╠══════════════════════════════════════════════════════════════╣
║ WebSocket                                                    ║
║   Connections: 100  ✅                                       ║
║   Messages: 2500                                             ║
║   Errors: 2  ⚠️                                              ║
║   Message Latency (p95): 85ms  ✅ (< 100ms)                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 5. Monitoreo de Golden Signals

### 5.1 Los 4 Pilares

| Signal         | Métrica PromQL                                                                           | Alerta       |
| -------------- | ---------------------------------------------------------------------------------------- | ------------ |
| **Latencia**   | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`               | > 500ms      |
| **Tráfico**    | `sum(rate(http_requests_total[5m]))`                                                     | Cambio > 50% |
| **Errores**    | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` | > 1%         |
| **Saturación** | `container_cpu_usage_seconds_total / container_spec_cpu_quota`                           | > 80%        |

### 5.2 Dashboard de Grafana

Importar el dashboard incluido en `k8s/grafana/golden-signals-dashboard.json`

### 5.3 Alertas Configuradas

| Alerta           | Condición               | Severidad |
| ---------------- | ----------------------- | --------- |
| HighErrorRate    | errors > 1% por 5m      | Critical  |
| HighLatency      | p95 > 500ms por 5m      | Warning   |
| ChatLatencyHigh  | chat p95 > 100ms por 2m | Warning   |
| PodCPUSaturation | CPU > 80% por 10m       | Warning   |
| PodRestarting    | restarts > 3 en 15m     | Critical  |

---

## 6. Checklist Pre-Producción

### Antes de Iniciar Canary

- [ ] Staging tests pasando (E2E + K6)
- [ ] Dashboards de Grafana configurados
- [ ] Alertas de PagerDuty/Slack activas
- [ ] Runbook de rollback documentado
- [ ] Equipo de guardia notificado

### Durante Canary (Cada Fase)

- [ ] Error rate < 1%
- [ ] Latency p95 < 500ms
- [ ] Chat latency < 100ms
- [ ] No alertas críticas
- [ ] Logs sin errores anormales

### Post-Migración

- [ ] 100% tráfico en microservicios
- [ ] Legacy apagado
- [ ] Documentación actualizada
- [ ] Retrospectiva programada

---

## 7. Comandos Útiles

```bash
# Ver logs del Gateway en tiempo real
kubectl logs -f -l app=api-gateway -n enova-staging

# Ver métricas de pods
kubectl top pods -n enova-staging

# Port-forward a Grafana local
kubectl port-forward svc/grafana 3001:3000 -n monitoring

# Escalar pods manualmente
kubectl scale deployment api-gateway --replicas=5 -n enova-staging

# Ver eventos recientes
kubectl get events -n enova-staging --sort-by='.lastTimestamp'
```

---

## 8. Contactos de Emergencia

| Rol           | Nombre | Contacto  |
| ------------- | ------ | --------- |
| SRE Lead      | TBD    | @sre-lead |
| Dev Lead      | TBD    | @dev-lead |
| Product Owner | TBD    | @product  |

---

## Apéndice: URLs de Entornos

| Entorno    | Frontend          | API Gateway           | Grafana                   |
| ---------- | ----------------- | --------------------- | ------------------------- |
| Local      | localhost:3000    | localhost:3000        | -                         |
| Staging    | staging.enova.com | staging-api.enova.com | grafana.staging.enova.com |
| Producción | enova.com         | api.enova.com         | grafana.enova.com         |
