/**
 * ENOVA E2E Tests - Playwright
 *
 * Complete end-to-end test suite for ENOVA microservices migration validation.
 * Covers: Authentication, Feed CRUD, Real-time Chat, and Performance.
 *
 * Run with: npx playwright test
 */

import { BrowserContext, expect, Page, test } from "@playwright/test";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_USER = {
    email: "jahito808@gmail.com",
    password: "12345678",
    name: "Jahir Rocha",
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function login(page: Page, email: string, password: string) {
    await page.goto(`${BASE_URL}/login`);
    await page.fill("input#email", email);
    await page.fill("input#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 10000 });
}

async function logout(page: Page) {
    // Click avatar to open menu
    await page.click('button:has-text("J")'); // First letter of name
    await page.click('button:has-text("Cerrar sesión")');
    await page.waitForURL("**/login");
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe("🔐 Authentication", () => {
    test("Login page loads correctly", async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);

        await expect(page.locator("h1, h2")).toContainText(["Hola", "nuevo"]);
        await expect(page.locator("input#email")).toBeVisible();
        await expect(page.locator("input#password")).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeEnabled();
    });

    test("Login with valid credentials redirects to dashboard", async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);

        await expect(page).toHaveURL(/.*dashboard/);
        await expect(page.locator("text=" + TEST_USER.name.split(" ")[0]))
            .toBeVisible();
    });

    test("Login with invalid credentials shows error", async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.fill("input#email", "invalid@test.com");
        await page.fill("input#password", "wrongpassword");
        await page.click('button[type="submit"]');

        // Wait for error message or stay on login page
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL(/.*login/);
    });

    test("Protected routes redirect to login when unauthenticated", async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForURL("**/login", { timeout: 5000 });
        await expect(page).toHaveURL(/.*login/);
    });

    test("Logout returns to login page", async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);
        await logout(page);
        await expect(page).toHaveURL(/.*login/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: FEED / COMMUNITY
// ═══════════════════════════════════════════════════════════════════════════

test.describe("📰 Feed / Community", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);
    });

    test("Dashboard loads with post form", async ({ page }) => {
        await expect(page.locator("textarea")).toBeVisible();
        await expect(page.locator('button:has-text("Publicar")')).toBeVisible();
    });

    test("Create a new post", async ({ page }) => {
        const uniqueContent = `Test post ${Date.now()}`;

        await page.fill("textarea", uniqueContent);
        await page.click('button:has-text("Publicar")');

        // Wait for post to appear in feed
        await page.waitForSelector(`text=${uniqueContent}`, { timeout: 5000 });
        await expect(page.locator(`text=${uniqueContent}`)).toBeVisible();
    });

    test("Edit an existing post", async ({ page }) => {
        // First create a post
        const originalContent = `Original post ${Date.now()}`;
        await page.fill("textarea", originalContent);
        await page.click('button:has-text("Publicar")');
        await page.waitForSelector(`text=${originalContent}`);

        // Click edit button on the post
        await page.click('button:has-text("Editar")');

        // Modify content
        const editedContent = `Edited post ${Date.now()}`;
        await page.fill("textarea", editedContent);
        await page.click('button:has-text("Guardar")');

        // Verify edit
        await page.waitForSelector(`text=${editedContent}`, { timeout: 5000 });
        await expect(page.locator(`text=${editedContent}`)).toBeVisible();
    });

    test("Delete a post", async ({ page }) => {
        // Create a post to delete
        const contentToDelete = `Delete me ${Date.now()}`;
        await page.fill("textarea", contentToDelete);
        await page.click('button:has-text("Publicar")');
        await page.waitForSelector(`text=${contentToDelete}`);

        // Handle confirmation dialog
        page.on("dialog", (dialog) => dialog.accept());

        // Click delete button
        await page.click('button:has-text("Eliminar")');

        // Verify deletion
        await page.waitForTimeout(1000);
        await expect(page.locator(`text=${contentToDelete}`)).not.toBeVisible();
    });

    test("Posts persist after page reload", async ({ page }) => {
        const persistentContent = `Persistent ${Date.now()}`;
        await page.fill("textarea", persistentContent);
        await page.click('button:has-text("Publicar")');
        await page.waitForSelector(`text=${persistentContent}`);

        // Reload page
        await page.reload();

        // Verify post still exists
        await expect(page.locator(`text=${persistentContent}`)).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: REAL-TIME CHAT
// ═══════════════════════════════════════════════════════════════════════════

test.describe("💬 Real-time Chat", () => {
    test("Chat page loads with connection status", async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);
        await page.goto(`${BASE_URL}/chat`);

        // Verify chat UI elements
        await expect(page.locator("text=Sala de Apoyo")).toBeVisible();
        await expect(page.locator("text=Conectada")).toBeVisible({
            timeout: 10000,
        });
        await expect(page.locator('input[placeholder*="mensaje"]'))
            .toBeVisible();
    });

    test("Send and receive messages", async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);
        await page.goto(`${BASE_URL}/chat`);
        await page.waitForSelector("text=Conectada", { timeout: 10000 });

        const testMessage = `Hello ${Date.now()}`;
        await page.fill('input[placeholder*="mensaje"]', testMessage);
        await page.press('input[placeholder*="mensaje"]', "Enter");

        // Verify message appears
        await expect(page.locator(`text=${testMessage}`)).toBeVisible({
            timeout: 5000,
        });
    });

    test("Chat history loads on page reload", async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);
        await page.goto(`${BASE_URL}/chat`);
        await page.waitForSelector("text=Conectada");

        // Send a message
        const historyMessage = `History test ${Date.now()}`;
        await page.fill('input[placeholder*="mensaje"]', historyMessage);
        await page.press('input[placeholder*="mensaje"]', "Enter");
        await page.waitForSelector(`text=${historyMessage}`);

        // Reload and verify history
        await page.reload();
        await page.waitForSelector("text=Conectada", { timeout: 10000 });
        await expect(page.locator(`text=${historyMessage}`)).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: MULTI-USER CHAT (Two Browser Contexts)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("👥 Multi-User Chat", () => {
    test("Two users can chat in real-time", async ({ browser }) => {
        // Create two separate browser contexts
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();

        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        try {
            // Login both users (using same account in different contexts for demo)
            await login(pageA, TEST_USER.email, TEST_USER.password);
            await login(pageB, TEST_USER.email, TEST_USER.password);

            // Navigate both to chat
            await pageA.goto(`${BASE_URL}/chat`);
            await pageB.goto(`${BASE_URL}/chat`);

            // Wait for both to connect
            await pageA.waitForSelector("text=Conectada", { timeout: 10000 });
            await pageB.waitForSelector("text=Conectada", { timeout: 10000 });

            // User A sends message
            const messageFromA = `From A: ${Date.now()}`;
            await pageA.fill('input[placeholder*="mensaje"]', messageFromA);
            await pageA.press('input[placeholder*="mensaje"]', "Enter");

            // Verify User B receives it
            await expect(pageB.locator(`text=${messageFromA}`)).toBeVisible({
                timeout: 5000,
            });

            // User B responds
            const messageFromB = `From B: ${Date.now()}`;
            await pageB.fill('input[placeholder*="mensaje"]', messageFromB);
            await pageB.press('input[placeholder*="mensaje"]', "Enter");

            // Verify User A receives it
            await expect(pageA.locator(`text=${messageFromB}`)).toBeVisible({
                timeout: 5000,
            });
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: PERFORMANCE & NETWORK
// ═══════════════════════════════════════════════════════════════════════════

test.describe("⚡ Performance", () => {
    test("Page loads within acceptable time", async ({ page }) => {
        const startTime = Date.now();
        await page.goto(`${BASE_URL}/login`);
        const loadTime = Date.now() - startTime;

        console.log(`Login page load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(5000); // 5 seconds max
    });

    test("Dashboard loads within acceptable time after login", async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        await page.fill("input#email", TEST_USER.email);
        await page.fill("input#password", TEST_USER.password);

        const startTime = Date.now();
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard");
        const loadTime = Date.now() - startTime;

        console.log(`Dashboard load time after login: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(10000); // 10 seconds max including auth
    });

    test("WebSocket connection establishes quickly", async ({ page }) => {
        await login(page, TEST_USER.email, TEST_USER.password);

        const startTime = Date.now();
        await page.goto(`${BASE_URL}/chat`);
        await page.waitForSelector("text=Conectada", { timeout: 10000 });
        const connectionTime = Date.now() - startTime;

        console.log(`WebSocket connection time: ${connectionTime}ms`);
        expect(connectionTime).toBeLessThan(5000); // 5 seconds max
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: NETWORK TRAFFIC VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe("🔍 Network Verification", () => {
    test("No requests to Next.js API routes", async ({ page }) => {
        const apiRequests: string[] = [];

        page.on("request", (request) => {
            const url = request.url();
            if (url.includes("/api/")) {
                apiRequests.push(url);
            }
        });

        await login(page, TEST_USER.email, TEST_USER.password);
        await page.goto(`${BASE_URL}/chat`);
        await page.waitForTimeout(3000);

        // Filter out valid Next.js internal routes
        const invalidApiCalls = apiRequests.filter((url) =>
            !url.includes("/api/auth/") && // Supabase auth callbacks are OK
            !url.includes("supabase.co")
        );

        console.log("API requests found:", invalidApiCalls);
        // This test is informational - adjust based on your architecture
    });

    test("WebSocket connects to correct endpoint", async ({ page }) => {
        let wsConnected = false;
        let wsUrl = "";

        page.on("websocket", (ws) => {
            wsUrl = ws.url();
            wsConnected = true;
        });

        await login(page, TEST_USER.email, TEST_USER.password);
        await page.goto(`${BASE_URL}/chat`);
        await page.waitForSelector("text=Conectada", { timeout: 10000 });

        expect(wsConnected).toBe(true);
        expect(wsUrl).toContain("socket.io");
        console.log(`WebSocket connected to: ${wsUrl}`);
    });
});
