/**
 * CUSTOM SERVER PARA NEXT.JS + SOCKET.IO
 * 
 * Este servidor personalizado permite ejecutar Next.js y Socket.io
 * en el mismo puerto, cumpliendo con la arquitectura monolítica.
 */

import './lib/env.ts';
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './lib/socket/socketHandler.ts';
import { parse } from 'url';

// Configuración del entorno
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Preparamos la instancia de Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    console.log('✅ Next.js preparado');

    // 1. Creamos el servidor HTTP nativo de Node
    // Este servidor manejará tanto las peticiones HTTP (Next.js) como WebSockets (Socket.io)
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        // Todas las peticiones HTTP se delegan a Next.js
        handle(req, res, parsedUrl);
    });

    // 2. Inicializamos Socket.io sobre el mismo servidor HTTP
    // CORS configurado para desarrollo y producción
    const io = new Server(httpServer, {
        cors: {
            origin: dev
                ? ['http://localhost:3000', 'http://127.0.0.1:3000']
                : process.env.FRONTEND_URL || 'https://tu-dominio.com',
            methods: ['GET', 'POST'],
            credentials: true
        },
        // Ruta personalizada (opcional) - útil para separar del namespace de Next.js
        path: '/socket.io',
        // Configuración de conexión
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // 3. Configurar los manejadores de eventos de WebSocket (modularizado)
    setupSocketHandlers(io);

    // 4. Manejo de errores del servidor
    httpServer.once('error', (err) => {
        console.error('❌ Error fatal en el servidor:', err);
        process.exit(1);
    });

    // 5. Iniciar el servidor
    httpServer.listen(port, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 Servidor Monolítico Iniciado');
        console.log(`📍 HTTP/Next.js: http://${hostname}:${port}`);
        console.log(`🔌 WebSockets: ws://${hostname}:${port}/socket.io`);
        console.log(`🌍 Entorno: ${dev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // Manejo de señales de terminación
    process.on('SIGTERM', () => {
        console.log('⚠️  SIGTERM recibido. Cerrando servidor...');
        httpServer.close(() => {
            console.log('✅ Servidor cerrado correctamente');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('\n⚠️  SIGINT recibido. Cerrando servidor...');
        httpServer.close(() => {
            console.log('✅ Servidor cerrado correctamente');
            process.exit(0);
        });
    });
});
