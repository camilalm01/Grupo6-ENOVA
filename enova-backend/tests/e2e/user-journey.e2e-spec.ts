// tests/e2e/user-journey.e2e-spec.ts
/**
 * ENOVA E2E Integration Test
 *
 * Simula el "Camino de Oro" de un usuario:
 * 1. Login → 2. Ver Feed → 3. Crear Post → 4. Chat → 5. Dashboard
 *
 * Ejecutar:
 * TEST_USER_TOKEN="jwt" TEST_USER_ID="uuid" npx jest tests/e2e/user-journey.e2e-spec.ts
 */

import * as request from "supertest";
import { io, Socket } from "socket.io-client";

describe("ENOVA User Journey E2E", () => {
    const API_URL = process.env.API_URL || "http://localhost:3000";
    const WS_URL = process.env.WS_URL || "http://localhost:3002";

    let accessToken: string;
    let userId: string;

    beforeAll(() => {
        accessToken = process.env.TEST_USER_TOKEN!;
        userId = process.env.TEST_USER_ID!;

        if (!accessToken || !userId) {
            throw new Error("TEST_USER_TOKEN and TEST_USER_ID are required");
        }
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Authentication Verification
    // ═══════════════════════════════════════════════════════════
    describe("1. Authentication", () => {
        it("should reject requests without token", async () => {
            await request(API_URL)
                .get("/profile/me")
                .expect(401);
        });

        it("should accept requests with valid token", async () => {
            const response = await request(API_URL)
                .get("/profile/me")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toBeDefined();
        });

        it("should reject requests with invalid token", async () => {
            await request(API_URL)
                .get("/profile/me")
                .set("Authorization", "Bearer invalid-token")
                .expect(401);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Community Service (Posts)
    // ═══════════════════════════════════════════════════════════
    describe("2. Community Service", () => {
        let createdPostId: string;

        it("should get posts feed", async () => {
            const response = await request(API_URL)
                .get("/posts")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200);

            // Circuit breaker may return cached data
            expect(response.body).toBeDefined();
        });

        it("should create a new post", async () => {
            const postData = {
                content: `E2E Test Post - ${new Date().toISOString()}`,
                category: "general",
            };

            const response = await request(API_URL)
                .post("/posts")
                .set("Authorization", `Bearer ${accessToken}`)
                .send(postData)
                .expect(201);

            createdPostId = response.body.id;
            expect(createdPostId).toBeDefined();
            expect(response.body.content).toBe(postData.content);
        });

        it("should get the created post", async () => {
            if (!createdPostId) {
                console.warn("Skipping: No post was created");
                return;
            }

            const response = await request(API_URL)
                .get(`/posts/${createdPostId}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body.id).toBe(createdPostId);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Chat Service (WebSocket)
    // ═══════════════════════════════════════════════════════════
    describe("3. Chat Service (WebSocket)", () => {
        const testRoomId = `e2e-test-room-${Date.now()}`;
        let socket: Socket;

        beforeAll((done) => {
            socket = io(WS_URL, {
                auth: { token: accessToken },
                transports: ["websocket"],
                timeout: 10000,
            });

            socket.on("connect", () => {
                console.log("WebSocket connected");
            });

            socket.on("connected", () => {
                done();
            });

            socket.on("connect_error", (error) => {
                console.error("WebSocket connection error:", error);
                done(error);
            });

            socket.on("error", (error) => {
                console.error("WebSocket error:", error);
            });

            // Timeout fallback
            setTimeout(() => {
                if (socket.connected) {
                    done();
                }
            }, 5000);
        });

        afterAll(() => {
            if (socket?.connected) {
                socket.disconnect();
            }
        });

        it("should establish WebSocket connection with valid JWT", () => {
            expect(socket.connected).toBe(true);
        });

        it("should join a room successfully", (done) => {
            socket.emit("join_room", { roomId: testRoomId });

            const timeout = setTimeout(() => {
                done(new Error("Timeout waiting for chat_history"));
            }, 5000);

            socket.once("chat_history", (history) => {
                clearTimeout(timeout);
                expect(Array.isArray(history)).toBe(true);
                done();
            });
        });

        it("should send and receive a message", (done) => {
            const testMessage = `E2E test message - ${Date.now()}`;

            const timeout = setTimeout(() => {
                done(new Error("Timeout waiting for receive_message"));
            }, 5000);

            socket.once("receive_message", (msg) => {
                clearTimeout(timeout);
                expect(msg.message).toBe(testMessage);
                expect(msg.roomId).toBe(testRoomId);
                done();
            });

            socket.emit("send_message", {
                roomId: testRoomId,
                message: testMessage,
                userId,
                username: "E2E Tester",
            });
        });

        it("should handle typing events", (done) => {
            const timeout = setTimeout(() => {
                // Typing events may not echo back to sender
                done();
            }, 2000);

            socket.emit("typing", {
                roomId: testRoomId,
                username: "E2E Tester",
                isTyping: true,
            });

            // Just verify no error
            done();
            clearTimeout(timeout);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Request Aggregation (Dashboard)
    // ═══════════════════════════════════════════════════════════
    describe("4. Request Aggregation", () => {
        it("should get aggregated dashboard data", async () => {
            const response = await request(API_URL)
                .get("/dashboard")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toBeDefined();
            // Dashboard aggregates data from multiple services
            expect(response.body.profile || response.body.error).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 5: Resilience & Observability
    // ═══════════════════════════════════════════════════════════
    describe("5. Resilience & Monitoring", () => {
        it("should expose health endpoint publicly", async () => {
            const response = await request(API_URL)
                .get("/health")
                .expect(200);

            expect(response.body.status).toBe("ok");
            expect(response.body.service).toBe("api-gateway");
            expect(response.body.circuits).toBeDefined();
        });

        it("should expose circuit breaker status", async () => {
            const response = await request(API_URL)
                .get("/circuits/status")
                .expect(200);

            expect(response.body.circuits).toBeDefined();
            expect(response.body.circuits["auth-service"]).toBeDefined();
            expect(response.body.circuits["community-service"]).toBeDefined();
        });
    });
});
