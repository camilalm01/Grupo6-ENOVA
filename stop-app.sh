#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# ENOVA - Script para Detener la Aplicación
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    🛑 ENOVA - Deteniendo                         ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Matar procesos de Node.js
echo -e "${YELLOW}⏳ Deteniendo servicios...${NC}"

pkill -f "nest start" 2>/dev/null && echo -e "   ✅ Backend detenido" || echo -e "   ⚪ Backend no estaba corriendo"
pkill -f "next dev" 2>/dev/null && echo -e "   ✅ Frontend detenido" || echo -e "   ⚪ Frontend no estaba corriendo"

sleep 1

# Liberar puertos por si acaso
for port in 3000 3001 3002; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        kill -9 $pid 2>/dev/null && echo -e "   ✅ Puerto $port liberado"
    fi
done

echo ""
echo -e "${GREEN}✅ ENOVA detenida completamente${NC}"
echo ""
