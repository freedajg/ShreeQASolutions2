// Warms up the dev server once before the tests start (Phase 1, step 12b). Playwright starts
// the webServer before globalSetup, so the server is up; this first load makes Vite compile the
// app and pre-bundle its dependencies before several browsers hit it at once. Without it, the
// first parallel page loads could take over 60 s on this laptop and time out.
// No session or storage is written; every request to the local Supabase ports is blocked.
import { chromium } from '@playwright/test';

const APP_URL = 'http://localhost:3000/';
const SUPABASE_PORTS = /^https?:\/\/(127\.0\.0\.1|localhost):5432[1-9]\//;

export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.route(SUPABASE_PORTS, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: 'load', timeout: 120_000 });
    // Let any Vite "new dependencies optimized" reload finish.
    await page.waitForTimeout(2_000);
    await context.close();
  } finally {
    await browser.close();
  }
}
