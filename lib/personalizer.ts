import { env } from '@/lib/env';
import type { Contact, Event, DraftResult } from '@/types/database';

const SPONSOR_OPENERS = [
  "I came across {company} while researching companies doing interesting work in {industry}, and was genuinely impressed by what you're building.",
  "I've been following {company}'s work in {industry} and it really stood out to me. You're solving a problem a lot of founders at UCSD are thinking about.",
  "Your work at {company} caught my attention, the way you're approaching {industry} is exactly the kind of thinking our community gets excited about.",
  "I stumbled across {company} recently and spent a good chunk of time on your website, what you're building in {industry} is really compelling.",
];

const SPONSOR_OPENERS_NO_INDUSTRY = [
  "I came across {company} recently and was really impressed by what you're building.",
  "I've been researching companies to reach out to and {company} immediately stood out.",
  "Your work at {company} caught my attention, it's exactly the kind of company our community gets excited about.",
  "I came across {company} and spent some time looking into what you're doing, I think there's a natural fit here.",
];

const SPEAKER_OPENERS = [
  "I came across your profile and your journey at {company} in the {industry} space is exactly the kind of story our members would learn a ton from.",
  "I've been researching speakers for our upcoming event and your work at {company} immediately came to mind.",
  "Your background building {company} in {industry} is something I think would resonate deeply with our community of student founders.",
  "I came across your work at {company} and thought, this is exactly the kind of perspective our members need to hear.",
];

const SPEAKER_OPENERS_NO_INDUSTRY = [
  "I came across your profile and your journey at {company} is exactly the kind of story our members would learn a ton from.",
  "I've been researching speakers for our upcoming event and your name came up immediately.",
  "Your background building {company} is something I think would resonate deeply with our community.",
  "I came across your work and thought, this is exactly the perspective our members need to hear.",
];

const DESC_OPENERS = [
  "I came across {company}, {desc_short}, and it immediately stood out to me as something our community would genuinely care about.",
  "I was researching companies in this space and {company}'s work, {desc_short}, really caught my attention.",
  "{company}'s focus on {desc_short} is something that resonates a lot with the founders we work with at UCSD.",
];

const CLUB_INTROS = [
  "{club} is a student entrepreneurship club at UC San Diego. We run pitch competitions, founder workshops, and speaker events, and our members are some of the most driven early-stage builders on campus.",
  "{club} brings together the most ambitious student founders at UC San Diego through pitch competitions, workshops, and real-world mentorship opportunities.",
  "We run {club} at UC San Diego, a community of ~200 student founders and builders who are actively working on startups, not just studying them.",
  "{club} is UCSD's most active student startup community. We run events that connect students directly with founders, operators, and investors.",
];

const SPONSOR_ASKS_WITH_EVENT = [
  "We're putting together {event_name} and are looking for a sponsor who'd be excited to get in front of {audience}. Would {company} be open to exploring what that could look like?",
  "For {event_name}, we're looking for a sponsor to help us bring this to life, and in exchange, {company} would get direct exposure to {audience}.",
  "We're hosting {event_name} and think {company} would be a great fit as a sponsor. It's a real opportunity to connect with {audience} who are actively building.",
];

const SPONSOR_ASKS_NO_EVENT = [
  "We're putting together our next event and are looking for a company that'd be excited to get in front of ~100+ motivated UCSD student founders. Would {company} be open to exploring sponsorship?",
  "We'd love to have {company} as a sponsor for one of our upcoming events, it's a genuine way to get in front of the next generation of founders at UCSD.",
  "We're looking for sponsors who want to connect with driven student builders, and {company} immediately came to mind. Would you be open to a conversation?",
];

const SPEAKER_ASKS_WITH_EVENT = [
  "For {event_name}, we're looking for a speaker who can share real experience building in this space, and I think your journey at {company} would be exactly what our members need to hear.",
  "We're hosting {event_name} and would love to have you as a speaker. Our members would get a lot of value from hearing how you built {company}.",
  "We're putting together the speaker lineup for {event_name} and your story at {company} immediately came to mind. Would you be open to joining us?",
];

const SPEAKER_ASKS_NO_EVENT = [
  "We'd love to have you speak at one of our upcoming events. Our members are building real companies and your experience at {company} is exactly the kind of insight they'd value.",
  "We're always looking for founders and operators who can share real stories, would you be open to speaking at one of our upcoming events?",
  "Your journey at {company} is exactly what our members need to hear. Would you be open to speaking at one of our upcoming events?",
];

const CTAS = [
  "Would you be open to a quick 15-minute call this week to explore what this could look like?",
  "Happy to jump on a quick call whenever works for you, even 15 minutes would be great.",
  "Would love to find 15 minutes to chat, completely flexible on timing.",
  "A quick 15-minute call would be ideal if you're open to it, I can work around your schedule.",
];

const SUBJECTS_SPONSOR = [
  'Sponsoring {event_name} @ UCSD — quick question',
  '{company} + {club} — sponsorship opportunity',
  'Quick question about {event_name}',
  'Sponsorship: {event_name} at {club}',
];

const SUBJECTS_SPONSOR_NO_EVENT = [
  '{company} + {club} — sponsorship opportunity',
  'Quick question for {company}',
  'Connecting {company} with UCSD founders',
  'Sponsorship opportunity — {club} @ UCSD',
];

const SUBJECTS_SPEAKER = [
  'Speaking at {event_name} — would love to have you',
  'Speaker invite: {event_name} @ {club}',
  'Quick ask — would you speak at {event_name}?',
];

const SUBJECTS_SPEAKER_NO_EVENT = [
  'Would love to have you speak at {club}',
  'Speaker invite — {club} at UCSD',
  'Quick ask: speaking opportunity at {club}',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

function shortDesc(desc: string | null | undefined): string {
  if (!desc) return '';
  const first = desc.trim().split(/(?<=[.!?])\s/)[0] ?? '';
  let s = first;
  if (s.length > 80) s = s.slice(0, 77) + '...';
  return s.toLowerCase().replace(/\.+$/, '');
}

function isFounder(title: string | null | undefined): boolean {
  const t = (title ?? '').toLowerCase();
  return ['founder', 'ceo', 'co-founder', 'owner', 'president', 'cto', 'coo'].some((w) => t.includes(w));
}

export type SenderInfo = { name: string; role: string };

export function generateEmail(
  contact: Pick<Contact, 'name' | 'company' | 'title' | 'industry' | 'description'>,
  event: Pick<Event, 'name' | 'what_we_need'> | null,
  sender: SenderInfo,
): DraftResult {
  const name = (contact.name ?? 'there').split(/\s+/)[0] ?? 'there';
  const company = contact.company ?? 'your company';
  const title = contact.title ?? '';
  const industry = contact.industry ?? '';
  const desc = contact.description ?? '';
  const desc_short = shortDesc(desc);

  const sender_name = sender.name ?? '';
  const sender_role = sender.role ?? 'President';

  const event_name = event?.name ?? '';
  const what_we_need = (event?.what_we_need ?? '').toLowerCase();

  let want_speaker = ['speak', 'speaker', 'talk', 'present'].some((w) => what_we_need.includes(w));
  let want_sponsor = ['sponsor', 'fund', 'partner', 'money', 'budget'].some((w) => what_we_need.includes(w));
  if (!want_speaker && !want_sponsor) {
    want_sponsor = !isFounder(title);
    want_speaker = isFounder(title);
  }

  const audience = 'our 200+ UCSD student founders';

  let opener: string;
  if (desc_short) {
    opener = fmt(pick(DESC_OPENERS), { company, desc_short });
  } else if (want_speaker) {
    opener = industry
      ? fmt(pick(SPEAKER_OPENERS), { company, industry })
      : fmt(pick(SPEAKER_OPENERS_NO_INDUSTRY), { company });
  } else {
    opener = industry
      ? fmt(pick(SPONSOR_OPENERS), { company, industry })
      : fmt(pick(SPONSOR_OPENERS_NO_INDUSTRY), { company });
  }

  const club_intro = fmt(pick(CLUB_INTROS), { club: env.CLUB_NAME });

  let ask: string;
  if (want_speaker) {
    ask = event_name
      ? fmt(pick(SPEAKER_ASKS_WITH_EVENT), { event_name, company })
      : fmt(pick(SPEAKER_ASKS_NO_EVENT), { company });
  } else {
    ask = event_name
      ? fmt(pick(SPONSOR_ASKS_WITH_EVENT), { event_name, company, audience })
      : fmt(pick(SPONSOR_ASKS_NO_EVENT), { company });
  }

  const cta = pick(CTAS);

  let subject: string;
  if (want_speaker) {
    subject = event_name
      ? fmt(pick(SUBJECTS_SPEAKER), { event_name, club: env.CLUB_NAME, company })
      : fmt(pick(SUBJECTS_SPEAKER_NO_EVENT), { club: env.CLUB_NAME, company });
  } else {
    subject = event_name
      ? fmt(pick(SUBJECTS_SPONSOR), { event_name, club: env.CLUB_NAME, company })
      : fmt(pick(SUBJECTS_SPONSOR_NO_EVENT), { club: env.CLUB_NAME, company });
  }

  const body = `Hi ${name},

${opener}

${club_intro}

${ask}

${cta}

Best,
${sender_name}
${sender_role}, ${env.CLUB_NAME}`;

  return { subject, body };
}
