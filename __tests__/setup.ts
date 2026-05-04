import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './helpers/msw';

// Force deterministic test env
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.SENDER_EMAIL = 'sender@test.com';
process.env.CLUB_NAME = 'Startup Incubator at UCSD';
process.env.CLUB_WEBSITE = 'startupincubatorsd.com';
process.env.USE_AI = 'true';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
