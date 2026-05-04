export type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export type Event = {
  id: number;
  name: string;
  date: string | null;
  description: string | null;
  what_we_need: string | null;
  created_by: string | null;
  created_at: string;
};

export type Contact = {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  source: string | null;
  added_at: string;
};

export type ContactWithStats = Contact & {
  last_sent: string | null;
  times_contacted: number;
};

export type Outreach = {
  id: number;
  contact_id: number;
  event_id: number | null;
  user_id: string | null;
  channel: string;
  status: 'draft' | 'sent' | 'skipped';
  subject: string | null;
  body: string | null;
  sent_at: string | null;
};

export type QueueItem = Contact & {
  outreach_id: number;
  subject: string;
  body: string;
  event_id: number | null;
  user_id: string | null;
  event_name: string | null;
};

export type Stats = {
  total_contacts: number;
  emails_sent: number;
  pending_drafts: number;
  sent_today: number;
  email_configured: boolean;
  ai_backend: 'gemini' | 'template';
};

export type DraftResult = {
  subject: string;
  body: string;
};
