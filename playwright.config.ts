import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for ENOVA E2E Tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ["html", { outputFolder: "playwright-report" }],
        ["json", { outputFile: "test-results.json" }],
        ["list"],
    ],

    use: {
        baseURL: process.env.BASE_URL || "http://localhost:3000",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
        },
        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
        },
        // Mobile viewports
        {
            name: "Mobile Chrome",
            use: { ...devices["Pixel 5"] },
        },
        {
            name: "Mobile Safari",
            use: { ...devices["iPhone 12"] },
        },
    ],

    // Configure timeouts
    timeout: 60000,
    expect: {
        timeout: 10000,
    },
    // Web server configuration (optional - if you want Playwright to start the server)
    // webServer: {
    //   command: 'npm run dev:chat',
    //   url: 'http://localhost:3000',
    //   reuseExistingServer: !process.env.CI,
    //   timeout: 120000,
    // },
});
