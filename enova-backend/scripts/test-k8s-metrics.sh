#!/bin/bash

# Script de Verificación de Métricas en Kubernetes
# =================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="${1:-enova}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🚀 Test de Observabilidad ENOVA - Kubernetes            ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}1. Verificando pods en namespace ${NAMESPACE}...${NC}"
echo ""

kubectl get pods -n "$NAMESPACE" -l 'app in (api-gateway,auth-service,chat-service,community-service)' \
    -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,READY:.status.containerStatuses[0].ready,RESTARTS:.status.containerStatuses[0].restartCount

echo ""
echo -e "${BLUE}2. Verificando servicios...${NC}"
echo ""

kubectl get svc -n "$NAMESPACE" -l 'app in (api-gateway,auth-service,chat-service,community-service)'

echo ""
echo -e "${BLUE}3. Verificando annotations de Prometheus...${NC}"
echo ""

for service in api-gateway auth-service chat-service community-service; do
    echo -e "${YELLOW}${service}:${NC}"
    kubectl get pod -n "$NAMESPACE" -l "app=${service}" -o json 2>/dev/null | \
        jq -r '.items[0].metadata.annotations | with_entries(select(.key | startswith("prometheus.io")))' 2>/dev/null || \
        echo "  No annotations found"
    echo ""
done

echo ""
echo -e "${BLUE}4. Testeando endpoints de métricas desde los pods...${NC}"
echo ""

# Función para testear métricas desde un pod
test_metrics_from_pod() {
    local service=$1
    local port=$2

    pod=$(kubectl get pod -n "$NAMESPACE" -l "app=${service}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

    if [ -z "$pod" ]; then
        echo -e "${RED}✗${NC} No pod found for ${service}"
        return 1
    fi

    echo -e "${YELLOW}Testing ${service} (pod: ${pod})${NC}"

    # Ejecutar curl desde el pod
    result=$(kubectl exec -n "$NAMESPACE" "$pod" -- curl -s -w "\n%{http_code}" "http://localhost:${port}/metrics" 2>/dev/null || echo "FAILED")

    if echo "$result" | tail -1 | grep -q "200"; then
        echo -e "${GREEN}✓${NC} Métricas disponibles en http://localhost:${port}/metrics"

        # Contar métricas
        metric_count=$(echo "$result" | grep -c "^# HELP" || echo "0")
        echo -e "  📊 Total de métricas: ${metric_count}"

        # Verificar métricas clave
        if echo "$result" | grep -q "process_cpu_seconds_total"; then
            echo -e "  ${GREEN}✓${NC} Runtime metrics OK"
        fi

        if echo "$result" | grep -q "http_requests_total\|rpc_messages_total"; then
            echo -e "  ${GREEN}✓${NC} Application metrics OK"
        fi
    else
        echo -e "${RED}✗${NC} Failed to get metrics"
        echo "$result" | head -5
    fi
    echo ""
}

# Testear cada servicio
test_metrics_from_pod "api-gateway" "3000"
test_metrics_from_pod "auth-service" "9091"
test_metrics_from_pod "chat-service" "3002"
test_metrics_from_pod "community-service" "9091"

echo ""
echo -e "${BLUE}5. Verificando Prometheus targets...${NC}"
echo ""

# Port-forward a Prometheus si está corriendo
prometheus_pod=$(kubectl get pod -n "$NAMESPACE" -l "app=prometheus" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$prometheus_pod" ]; then
    echo "Verificando targets en Prometheus..."
    echo "Para ver los targets, ejecuta:"
    echo ""
    echo -e "${YELLOW}kubectl port-forward -n ${NAMESPACE} ${prometheus_pod} 9090:9090${NC}"
    echo ""
    echo "Luego abre: http://localhost:9090/targets"
    echo ""

    # Verificar configuración de scrape
    echo "Configuración de scrape jobs:"
    kubectl get configmap -n "$NAMESPACE" prometheus-config -o jsonpath='{.data.prometheus\.yml}' | grep -A 5 "job_name:"
else
    echo -e "${YELLOW}⚠${NC} Prometheus pod not found in namespace ${NAMESPACE}"
fi

echo ""
echo -e "${BLUE}6. Verificando Grafana...${NC}"
echo ""

grafana_pod=$(kubectl get pod -n "$NAMESPACE" -l "app=grafana" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -n "$grafana_pod" ]; then
    echo "Grafana encontrado: ${grafana_pod}"
    echo ""
    echo "Para acceder a Grafana, ejecuta:"
    echo ""
    echo -e "${YELLOW}kubectl port-forward -n ${NAMESPACE} ${grafana_pod} 3001:3000${NC}"
    echo ""
    echo "Luego abre: http://localhost:3001"
    echo ""
    echo "Dashboard: ENOVA Golden Signals Dashboard"
    echo "UID: enova-golden-signals"
else
    echo -e "${YELLOW}⚠${NC} Grafana pod not found in namespace ${NAMESPACE}"
fi

echo ""
echo -e "${BLUE}7. Logs recientes de los servicios...${NC}"
echo ""

for service in api-gateway auth-service chat-service community-service; do
    echo -e "${YELLOW}${service}:${NC}"
    kubectl logs -n "$NAMESPACE" -l "app=${service}" --tail=3 2>/dev/null | grep -E "(Metrics|metrics|📊)" || echo "  No metrics logs found"
    echo ""
done

echo ""
echo -e "${BLUE}8. Queries recomendadas para validar en Prometheus:${NC}"
echo ""
echo -e "${YELLOW}# Ver todos los servicios que están siendo scrapeados${NC}"
echo "up{namespace=\"${NAMESPACE}\"}"
echo ""
echo -e "${YELLOW}# Request rate por servicio${NC}"
echo "sum(rate(http_requests_total{namespace=\"${NAMESPACE}\"}[5m])) by (service)"
echo ""
echo -e "${YELLOW}# Verificar que todas las métricas existen${NC}"
echo "count({namespace=\"${NAMESPACE}\"}) by (__name__)"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Verificación en Kubernetes completa${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
