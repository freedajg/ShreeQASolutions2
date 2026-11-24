import { defineConfig, devices } from '@playwright/test';
import { STACK_URL, TEST_ANON_KEY } from './tests/support/auth';

const PORT = 3000;

export default defineConfig({
  testDir: 'tests',
  // Warms up the dev server once (started before this runs) so parallel first loads are fast.
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Starts the dev server for the tests, or reuses one you already have running.
  webServer: {
    command: 'bun run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // The local URL and a fake anon key for the mocked stack (tests/support/auth.ts). They apply
    // only when Playwright starts the dev server itself (then they win over .env.local). With
    // reuseExistingServer, an already-running dev server keeps its .env.local values; either
    // way the mocks answer or abort every request to the stack, so no test reaches a database.
    env: { VITE_SUPABASE_URL: STACK_URL, VITE_SUPABASE_ANON_KEY: TEST_ANON_KEY },
  },
});
