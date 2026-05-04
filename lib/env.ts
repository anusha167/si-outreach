export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
  BREVO_API_KEY: process.env.BREVO_API_KEY ?? '',
  SENDER_EMAIL: process.env.SENDER_EMAIL ?? '',
  CLUB_NAME: process.env.CLUB_NAME ?? 'Startup Incubator at UCSD',
  CLUB_WEBSITE: process.env.CLUB_WEBSITE ?? 'startupincubatorsd.com',
  USE_AI: (process.env.USE_AI ?? 'true').toLowerCase() !== 'false',
};
