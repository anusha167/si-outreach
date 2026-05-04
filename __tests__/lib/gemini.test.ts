import { describe, it, expect } from 'vitest';
import { http, HttpResponse, server } from '@tests/helpers/msw';
import { parseSubjectBody, draftEmail, redraftEmail, testGemini } from '@/lib/gemini';
import type { Contact, Event } from '@/types/database';

const GEMINI_RE = /generativelanguage\.googleapis\.com\/v1beta\/models\/(.+)/;

const baseContact: Contact = {
  id: 1,
  name: 'Jane',
  email: 'j@x.com',
  company: 'Acme',
  title: 'CEO',
  linkedin_url: '',
  website: '',
  description: '',
  industry: 'Fintech',
  location: '',
  source: '',
  added_at: '',
};

describe('parseSubjectBody', () => {
  it('extracts SUBJECT and body', () => {
    const text = 'SUBJECT: Hello there\n---\nBody copy goes here.';
    const out = parseSubjectBody(text);
    expect(out.subject).toBe('Hello there');
    expect(out.body).toContain('Body copy');
  });
  it('returns body as-is when no SUBJECT marker', () => {
    const out = parseSubjectBody('Just a body');
    expect(out.subject).toBe('');
    expect(out.body).toBe('Just a body');
  });
});

describe('Gemini API integration', () => {
  it('falls back to template when Gemini fails on all models', async () => {
    server.use(
      http.post(GEMINI_RE, () => HttpResponse.json({}, { status: 500 })),
    );
    const out = await draftEmail(baseContact, null, { name: 'Anusha', role: 'President' });
    expect(out.subject.length).toBeGreaterThan(0);
    expect(out.body).toContain('Anusha');
  });

  it('uses Gemini polish output when first model returns 200', async () => {
    server.use(
      http.post(GEMINI_RE, () =>
        HttpResponse.json({
          candidates: [{ content: { parts: [{ text: 'SUBJECT: Polished\n---\nPolished body content.' }] } }],
        }),
      ),
    );
    const out = await draftEmail(baseContact, null, { name: 'Anusha', role: 'President' });
    expect(out.subject).toBe('Polished');
    expect(out.body).toContain('Polished body');
  });

  it('redraftEmail returns parsed Gemini output on success', async () => {
    server.use(
      http.post(GEMINI_RE, () =>
        HttpResponse.json({
          candidates: [{ content: { parts: [{ text: 'SUBJECT: Shorter\n---\nShorter body.' }] } }],
        }),
      ),
    );
    const out = await redraftEmail(
      baseContact,
      'make it shorter',
      'original body',
      { name: 'Anusha', role: 'President' },
      null,
    );
    expect(out.subject).toBe('Shorter');
  });

  it('testGemini returns gemini=true when reachable', async () => {
    server.use(
      http.post(GEMINI_RE, () =>
        HttpResponse.json({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      ),
    );
    const out = await testGemini();
    expect(out.gemini).toBe(true);
    expect(out.active_backend).toBe('gemini');
  });

  it('testGemini returns false when API errors', async () => {
    server.use(http.post(GEMINI_RE, () => HttpResponse.json({}, { status: 500 })));
    const out = await testGemini();
    expect(out.gemini).toBe(false);
    expect(out.active_backend).toBe('template');
  });
});

// Suppress unused import warning for Event
void ({} as Event);
