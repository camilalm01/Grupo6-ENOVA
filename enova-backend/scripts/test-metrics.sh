#!/bin/bash

# Script de Verificación de Métricas de Prometheus
# ================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔍 Test de Observabilidad ENOVA - Verificación Local    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Función para verificar si un puerto está escuchando
check_port() {
    local port=$1
    local service=$2
    if netstat -tuln 2>/dev/null | grep -q ":${port} "; then
        echo -e "${GREEN}✓${NC} Puerto ${port} (${service}) está activo"
        return 0
    else
        echo -e "${RED}✗${NC} Puerto ${port} (${service}) NO está activo"
        return 1
    fi
}

# Función para verificar endpoint de métricas
check_metrics_endpoint() {
    local url=$1
    local service=$2

    echo ""
    echo -e "${YELLOW}Verificando ${service}: ${url}${NC}"

    response=$(curl -s -w "\n%{http_code}" "${url}" 2>/dev/null || echo "000")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} Endpoint responde correctamente (HTTP 200)"

        # Verificar métricas clave
        metrics=$(echo "$response" | head -n -1)

        # Contar métricas
        total_metrics=$(echo "$metrics" | grep -c "^# HELP" || echo "0")
        echo -e "  📊 Total de métricas: ${total_metrics}"

        # Verificar métricas específicas
        if echo "$metrics" | grep -q "process_cpu_seconds_total"; then
            echo -e "  ${GREEN}✓${NC} Métricas de CPU disponibles"
        fi

        if echo "$metrics" | grep -q "nodejs_heap_size_used_bytes"; then
            echo -e "  ${GREEN}✓${NC} Métricas de Node.js disponibles"
        fi

        if echo "$metrics" | grep -q "http_requests_total" || echo "$metrics" | grep -q "rpc_messages_total"; then
            echo -e "  ${GREEN}✓${NC} Métricas de aplicación disponibles"
        fi

        # Mostrar algunas métricas de ejemplo
        echo ""
        echo -e "${YELLOW}Muestra de métricas:${NC}"
        echo "$metrics" | grep -E "^(http_requests_total|rpc_messages_total|nodejs_heap_size_used_bytes|process_cpu_seconds_total)" | head -5

        return 0
    else
        echo -e "${RED}✗${NC} Endpoint falló (HTTP ${http_code})"
        return 1
    fi
}

echo -e "${BLUE}1. Verificando puertos de servicios...${NC}"
echo ""

# Verificar puertos
check_port 3000 "API Gateway"
check_port 3001 "Auth Service (TCP)"
check_port 3002 "Chat Service"
check_port 3003 "Community Service (TCP)"
check_port 9091 "Metrics Server (Auth/Community)"

echo ""
echo -e "${BLUE}2. Verificando endpoints de métricas...${NC}"

# API Gateway
check_metrics_endpoint "http://localhost:3000/metrics" "API Gateway"

# Auth Service (metrics server)
check_metrics_endpoint "http://localhost:9091/metrics" "Auth Service"

# Chat Service
check_metrics_endpoint "http://localhost:3002/metrics" "Chat Service"

# Community Service (usa el mismo puerto 9091 que auth si corren en máquinas diferentes)
# En local necesitarías otro puerto, pero esto es para K8s

echo ""
echo -e "${BLUE}3. Generando tráfico de prueba...${NC}"
echo ""

# Generar algunas requests para ver métricas
echo "Enviando requests de prueba al API Gateway..."
for i in {1..5}; do
    curl -s "http://localhost:3000/health" > /dev/null 2>&1 && echo -e "${GREEN}✓${NC} Request $i enviada" || echo -e "${RED}✗${NC} Request $i falló"
    sleep 0.5
done

echo ""
echo -e "${BLUE}4. Verificando métricas actualizadas...${NC}"

# Verificar que las métricas se incrementaron
check_metrics_endpoint "http://localhost:3000/metrics" "API Gateway (actualizado)"

echo ""
echo -e "${BLUE}5. Queries de Prometheus sugeridas:${NC}"
echo ""
echo "Una vez que Prometheus esté scraping, prueba estas queries:"
echo ""
echo -e "${YELLOW}# Request Rate (QPS)${NC}"
echo "sum(rate(http_requests_total[5m])) by (service)"
echo ""
echo -e "${YELLOW}# Error Rate${NC}"
echo "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100"
echo ""
echo -e "${YELLOW}# P95 Latency${NC}"
echo "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))"
echo ""
echo -e "${YELLOW}# Node.js Heap Usage (MB)${NC}"
echo "nodejs_heap_size_used_bytes / 1024 / 1024"
echo ""
echo -e "${YELLOW}# Event Loop Lag${NC}"
echo "nodejs_eventloop_lag_seconds"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Verificación completa${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
