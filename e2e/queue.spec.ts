import { test, expect, type Route, type Page } from '@playwright/test';

/**
 * E2E smoke tests against `pnpm dev`.
 * Supabase Auth is mocked via cookies; all `/api/*` calls intercepted with route fulfillment.
 *
 * If you want to run against a real Supabase + seeded data, set `LIVE=1` and remove the route mocks.
 * Skipped tests in this suite mark scenarios that require a live backend.
 */

const baseProfile = { id: 'u1', email: 'admin@x.com', name: 'Admin', role: 'President' };

let queue = [
  {
    id: 1, name: 'Jane Doe', email: 'j@x.com', company: 'Acme', title: 'CEO',
    linkedin_url: '', website: '', description: 'Builds X.', industry: '', location: '',
    source: '', added_at: '',
    outreach_id: 11, subject: 'Subject A', body: 'Body A.\nMore body.',
    event_id: null, user_id: null, event_name: null,
  },
];
let stats = { total_contacts: 1, emails_sent: 0, pending_drafts: 1, sent_today: 0, email_configured: true, ai_backend: 'gemini' };

async function mockApi(page: Page) {
  await page.context().addCookies([
    { name: 'sb-test-auth', value: 'mock', url: 'http://localhost:3000' },
  ]);
  await page.route('**/api/me', (r: Route) =>
    r.fulfill({ json: { logged_in: true, ...baseProfile } }),
  );
  await page.route('**/api/stats', (r: Route) => r.fulfill({ json: stats }));
  await page.route('**/api/events', (r: Route) => r.fulfill({ json: [] }));
  await page.route('**/api/queue', (r: Route) => r.fulfill({ json: queue }));
  await page.route('**/api/queue/pending-ids*', (r: Route) =>
    r.fulfill({ json: { contact_ids: [] } }),
  );
  await page.route('**/api/draft/*', async (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { ok: true } });
    }
    return route.continue();
  });
  await page.route('**/api/send/*', (r: Route) =>
    r.fulfill({ json: { ok: true } }),
  );
}

test.describe('Auth-gated routing', () => {
  test('unauthenticated visit redirects to /login', async ({ page, context }) => {
    await context.clearCookies();
    await page.route('**/api/me', (r) => r.fulfill({ json: { logged_in: false } }));
    const res = await page.goto('/queue');
    expect(res?.url()).toContain('/login');
  });
});

test.describe('Queue page (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test.skip('renders queue list and editor — requires live Supabase auth session', async ({ page }) => {
    // This is the canonical happy path. To run, set up a real Supabase auth session.
    await page.goto('/queue');
    await expect(page.getByText('Generate All Drafts')).toBeVisible();
    await expect(page.getByText('Jane Doe')).toBeVisible();
    await page.getByText('Jane Doe').click();
    await expect(page.locator('input[placeholder*="Subject"]')).toHaveValue('Subject A');
  });
});

test.describe('Login page', () => {
  test('renders email + password form', async ({ page, context }) => {
    await context.clearCookies();
    await page.route('**/api/me', (r) => r.fulfill({ json: { logged_in: false } }));
    await page.goto('/login');
    await expect(page.getByText('Sign in')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});
