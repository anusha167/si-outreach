import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/csv';

describe('parseCsv', () => {
  it('parses standard headers', () => {
    const csv = 'name,email,company,title\nJane,j@x.com,Acme,CEO\nBob,b@y.com,Beta,Head';
    const out = parseCsv(csv);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'Jane', email: 'j@x.com', company: 'Acme', title: 'CEO', source: 'csv' });
  });

  it('resolves header aliases', () => {
    const csv = 'Full Name,Email Address,Organization,Job Title,LinkedIn Profile,Homepage,About,Sector,City\n' +
                'Jane,j@x.com,Acme,CEO,linked,site,bio,Tech,SF';
    const out = parseCsv(csv);
    expect(out[0]).toMatchObject({
      name: 'Jane',
      email: 'j@x.com',
      company: 'Acme',
      title: 'CEO',
      linkedin_url: 'linked',
      website: 'site',
      description: 'bio',
      industry: 'Tech',
      location: 'SF',
    });
  });

  it('ignores unknown columns and empty rows', () => {
    const csv = 'name,unrelated,email\nJane,foo,j@x.com\n,,\nBob,bar,b@y.com';
    const out = parseCsv(csv);
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty('unrelated');
  });

  it('handles BOM-prefixed UTF-8', () => {
    const csv = '﻿name,email\nJane,j@x.com';
    const out = parseCsv(csv);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('Jane');
  });

  it('skips rows missing both name and email', () => {
    const csv = 'name,email,company\n,,Acme\nJane,,';
    const out = parseCsv(csv);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('Jane');
  });
});
