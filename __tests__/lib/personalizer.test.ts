import { describe, it, expect } from 'vitest';
import { generateEmail } from '@/lib/personalizer';
import type { Contact, Event } from '@/types/database';

const baseContact: Contact = {
  id: 1,
  name: 'Jane Doe',
  email: 'jane@x.com',
  company: 'Acme',
  title: '',
  linkedin_url: '',
  website: '',
  description: '',
  industry: '',
  location: '',
  source: '',
  added_at: '',
};

const sender = { name: 'Anusha Shinde', role: 'President' };

describe('personalizer', () => {
  it('routes founder titles to speaker ask', () => {
    const out = generateEmail({ ...baseContact, title: 'Founder & CEO' }, null, sender);
    // Speaker subjects mention "speak" in some form
    expect(out.subject.toLowerCase()).toMatch(/(speak|speaker)/);
  });

  it('routes non-founder titles to sponsor ask', () => {
    // SPONSOR_ASKS_NO_EVENT all mention "sponsor" / "sponsorship" in the body.
    const out = generateEmail({ ...baseContact, title: 'Head of Marketing' }, null, sender);
    expect(out.body.toLowerCase()).toMatch(/sponsor/);
  });

  it('uses description-aware opener when description is present', () => {
    const out = generateEmail(
      { ...baseContact, description: 'A B2B fintech serving SMBs.' },
      null,
      sender,
    );
    expect(out.body).toMatch(/Acme/);
  });

  it('uses industry variant when industry is provided (sponsor mode)', () => {
    // All SPONSOR_OPENERS reference {industry}; non-founder titles route to sponsor mode.
    const out = generateEmail(
      { ...baseContact, industry: 'Fintech', title: 'Head of BD' },
      null,
      sender,
    );
    expect(out.body.toLowerCase()).toContain('fintech');
  });

  it('always returns a non-empty subject and body', () => {
    for (let i = 0; i < 20; i++) {
      const out = generateEmail({ ...baseContact, title: 'CEO' }, null, sender);
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.body.length).toBeGreaterThan(0);
    }
  });

  it('signs off with sender name + role + club', () => {
    const out = generateEmail(baseContact, null, sender);
    expect(out.body).toContain('Anusha Shinde');
    expect(out.body).toContain('President');
    expect(out.body).toContain('Startup Incubator at UCSD');
  });

  it('uses event name when an event is provided', () => {
    const event = {
      id: 1,
      name: 'Demo Day 2026',
      date: null,
      description: null,
      what_we_need: 'Looking for sponsors',
      created_by: null,
      created_at: '',
    } as Event;
    const out = generateEmail({ ...baseContact, title: 'Marketing Lead' }, event, sender);
    expect(out.body + out.subject).toMatch(/Demo Day 2026/);
  });

  it('switches to speaker mode when "what_we_need" mentions speakers', () => {
    const event = {
      id: 1,
      name: 'Founders Night',
      date: null,
      description: null,
      what_we_need: 'looking for a speaker who has built a startup',
      created_by: null,
      created_at: '',
    } as Event;
    const out = generateEmail(baseContact, event, sender);
    expect(out.subject.toLowerCase()).toMatch(/(speak|speaker)/);
  });
});
