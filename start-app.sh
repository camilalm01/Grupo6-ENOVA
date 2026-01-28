#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# ENOVA - Script de Arranque Unificado
# ═══════════════════════════════════════════════════════════════════════════════
# Este script levanta TODA la aplicación con un solo comando:
# - Mata procesos existentes en los puertos necesarios
# - Inicia API Gateway (puerto 3000)
# - Inicia Chat Service (puerto 3002)
# - Inicia Frontend Next.js (puerto 3001)
#
# USO: ./start-app.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$BASE_DIR/enova-backend"

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    🌸 ENOVA - Arranque Rápido                    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ───────────────────────────────────────────────────────────────────────────────
# PASO 1: Limpiar puertos
# ───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Paso 1/4: Liberando puertos...${NC}"

# Función para matar proceso en un puerto
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        kill -9 $pid 2>/dev/null && echo -e "   ✅ Puerto $port liberado (PID: $pid)"
    else
        echo -e "   ⚪ Puerto $port ya libre"
    fi
}

# Matar procesos de Node.js relacionados primero
pkill -f "nest start" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Liberar puertos específicos
kill_port 3000  # API Gateway
kill_port 3001  # Frontend
kill_port 3002  # Chat Service

sleep 2
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# PASO 2: Iniciar Backend - API Gateway
# ───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Paso 2/4: Iniciando API Gateway...${NC}"
cd "$BACKEND_DIR"
npm run start:gateway > /tmp/enova-gateway.log 2>&1 &
GATEWAY_PID=$!
echo -e "   🚀 API Gateway iniciando (PID: $GATEWAY_PID)"

# ───────────────────────────────────────────────────────────────────────────────
# PASO 3: Iniciar Backend - Chat Service
# ───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Paso 3/4: Iniciando Chat Service...${NC}"
npm run start:chat > /tmp/enova-chat.log 2>&1 &
CHAT_PID=$!
echo -e "   💬 Chat Service iniciando (PID: $CHAT_PID)"

# ───────────────────────────────────────────────────────────────────────────────
# PASO 4: Iniciar Frontend
# ───────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Paso 4/4: Iniciando Frontend...${NC}"
cd "$BASE_DIR"
npm run dev > /tmp/enova-frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "   🌐 Frontend iniciando (PID: $FRONTEND_PID)"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# ESPERAR Y VERIFICAR
# ───────────────────────────────────────────────────────────────────────────────
echo -e "${BLUE}⏳ Esperando que los servicios estén listos (15s)...${NC}"
sleep 15

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ ENOVA LISTA                                ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║  🌐 Frontend:       ${NC}http://localhost:3001${GREEN}                       ║${NC}"
echo -e "${GREEN}║  🚀 API Gateway:    ${NC}http://localhost:3000${GREEN}                       ║${NC}"
echo -e "${GREEN}║  💬 Chat Service:   ${NC}http://localhost:3002${GREEN}                       ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║  📊 Logs:                                                        ║${NC}"
echo -e "${GREEN}║     tail -f /tmp/enova-gateway.log                               ║${NC}"
echo -e "${GREEN}║     tail -f /tmp/enova-chat.log                                  ║${NC}"
echo -e "${GREEN}║     tail -f /tmp/enova-frontend.log                              ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}║  🛑 Para detener: ${NC}./stop-app.sh${GREEN}                                  ║${NC}"
echo -e "${GREEN}║                                                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar conectividad
echo -e "${BLUE}🔍 Verificando servicios...${NC}"
sleep 2

if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "   ✅ API Gateway: ${GREEN}OK${NC}"
else
    echo -e "   ⚠️  API Gateway: ${YELLOW}Iniciando...${NC} (ver /tmp/enova-gateway.log)"
fi

if curl -s "http://localhost:3002/socket.io/?EIO=4&transport=polling" > /dev/null 2>&1; then
    echo -e "   ✅ Chat Service: ${GREEN}OK${NC}"
else
    echo -e "   ⚠️  Chat Service: ${YELLOW}Iniciando...${NC} (ver /tmp/enova-chat.log)"
fi

if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo -e "   ✅ Frontend: ${GREEN}OK${NC}"
else
    echo -e "   ⚠️  Frontend: ${YELLOW}Iniciando...${NC} (ver /tmp/enova-frontend.log)"
fi

echo ""
echo -e "${PURPLE}🌸 ¡Abre http://localhost:3001 en tu navegador!${NC}"
echo ""
