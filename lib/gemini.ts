import { env } from '@/lib/env';
import { generateEmail, type SenderInfo } from '@/lib/personalizer';
import type { Contact, Event, DraftResult } from '@/types/database';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'] as const;
const PER_CALL_TIMEOUT_MS = 8000;

async function callGemini(prompt: string): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY');

  for (const model of GEMINI_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) return text.trim();
    } catch {
      clearTimeout(timer);
      continue;
    }
  }
  throw new Error('Gemini failed across all models');
}

export function parseSubjectBody(text: string): DraftResult {
  if (text.includes('SUBJECT:')) {
    const parts = text.split('---');
    const subject = (parts[0] ?? '').replace('SUBJECT:', '').trim();
    const body = (parts.slice(1).join('---') ?? '').trim() || text;
    return { subject, body };
  }
  return { subject: '', body: text };
}

export async function draftEmail(
  contact: Contact,
  event: Event | null,
  sender: SenderInfo,
): Promise<DraftResult> {
  const base = generateEmail(contact, event, sender);
  if (!env.USE_AI || !env.GEMINI_API_KEY) return base;

  const polishPrompt = `You are helping polish a cold outreach email for ${sender.name}, ${sender.role} of the ${env.CLUB_NAME}.

Here is a draft email:

Subject: ${base.subject}
---
${base.body}
---

Lightly polish this email to make it sound more natural and conversational.
- Keep it under 180 words
- Don't change the core message or structure
- Fix any awkward phrasing
- Keep the same sign-off

Reply in EXACTLY this format:
SUBJECT: <subject>
---
<body>
`;

  try {
    const text = await callGemini(polishPrompt);
    const parsed = parseSubjectBody(text);
    if (parsed.subject && parsed.body) return parsed;
  } catch {
    // fall through to template
  }
  return base;
}

export async function redraftEmail(
  contact: Contact,
  feedback: string,
  currentBody: string,
  sender: SenderInfo,
  event: Event | null,
): Promise<DraftResult> {
  const prompt = `Revise this cold outreach email based on the feedback.

Current email:
---
${currentBody}
---

Feedback: "${feedback}"

Keep it under 180 words. No em-dashes. Conversational.
Sign off as: ${sender.name}, ${sender.role}, ${env.CLUB_NAME}

Reply EXACTLY in this format:
SUBJECT: <subject>
---
<body>
`;

  try {
    const text = await callGemini(prompt);
    const parsed = parseSubjectBody(text);
    if (parsed.subject && parsed.body) return parsed;
  } catch {
    // fallthrough
  }
  return draftEmail(contact, event, sender);
}

export async function testGemini(): Promise<{ gemini: boolean; active_backend: 'gemini' | 'template' }> {
  if (!env.GEMINI_API_KEY) return { gemini: false, active_backend: 'template' };
  try {
    await callGemini('Reply with one word: ok');
    return { gemini: true, active_backend: 'gemini' };
  } catch {
    return { gemini: false, active_backend: 'template' };
  }
}
