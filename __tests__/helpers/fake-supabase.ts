/**
 * In-memory fake Supabase client for route handler tests.
 * Implements just enough of the Supabase JS query builder to drive our routes.
 *
 * Tables: profiles, contacts, events, outreach
 */
import type { Profile, Contact, Event, Outreach } from '@/types/database';

type Row = Record<string, unknown> & { id?: number | string };

type Filter = { col: string; op: 'eq' | 'ilike' | 'gte' | 'lt' | 'in'; val: unknown };

class QueryBuilder<T extends Row> {
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: T | T[] | null = null;
  private selectCols = '*';
  private wantSingle = false;
  private wantMaybeSingle = false;
  private headOnly = false;
  private countMode: 'exact' | null = null;
  private updatePayload: Partial<T> | null = null;
  private upsertOnConflict: string | null = null;

  constructor(
    private rowsRef: T[],
    private tableName: string,
    private allTables: FakeDb,
  ) {}

  select(cols = '*', opts: { count?: 'exact'; head?: boolean } = {}) {
    this.selectCols = cols;
    this.headOnly = !!opts.head;
    if (opts.count) this.countMode = opts.count;
    return this;
  }
  insert(payload: T | T[]) {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }
  update(p: Partial<T>) {
    this.mode = 'update';
    this.updatePayload = p;
    return this;
  }
  upsert(p: T | T[], opts: { onConflict?: string } = {}) {
    this.mode = 'upsert';
    this.payload = p;
    this.upsertOnConflict = opts.onConflict ?? null;
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }
  ilike(col: string, val: unknown) {
    this.filters.push({ col, op: 'ilike', val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ col, op: 'gte', val });
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push({ col, op: 'lt', val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ col, op: 'in', val: vals });
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderCol = col;
    this.orderAsc = opts.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this.run();
  }
  maybeSingle() {
    this.wantMaybeSingle = true;
    return this.run();
  }
  then<R = unknown>(resolve: (v: { data: unknown; error: null; count?: number | null }) => R) {
    return this.run().then(resolve);
  }

  private match(r: Row): boolean {
    return this.filters.every((f) => {
      const v = r[f.col];
      if (f.op === 'eq') return v === f.val;
      if (f.op === 'ilike') return String(v ?? '').toLowerCase() === String(f.val ?? '').toLowerCase();
      if (f.op === 'gte') return v != null && String(v) >= String(f.val);
      if (f.op === 'lt') return v != null && String(v) < String(f.val);
      if (f.op === 'in') return Array.isArray(f.val) && (f.val as unknown[]).includes(v);
      return false;
    });
  }

  /**
   * Parses select strings like 'id, subject, contact:contacts(name, email), event:events(*)'
   * Returns: an array of {alias, table, fields} for embedded relations.
   */
  private parseRelations(): { alias: string; table: keyof FakeDb; fields: string[] }[] {
    const out: { alias: string; table: keyof FakeDb; fields: string[] }[] = [];
    if (this.selectCols === '*') return out;
    const matches = this.selectCols.matchAll(/(\w+):(\w+)\(([^)]*)\)/g);
    for (const m of matches) {
      const fields = (m[3] ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
      out.push({ alias: m[1] ?? '', table: m[2] as keyof FakeDb, fields });
    }
    return out;
  }

  private embedRelations<U extends Row>(rows: U[]): U[] {
    const rels = this.parseRelations();
    if (rels.length === 0) return rows;
    return rows.map((r) => {
      const enriched = { ...r } as Row;
      for (const rel of rels) {
        // foreign key naming convention: <singular_table>_id (drop trailing s)
        const singular = rel.table.endsWith('s') ? rel.table.slice(0, -1) : rel.table;
        const fkCol = `${singular}_id`;
        const fkVal = (r as Row)[fkCol];
        const target = (this.allTables[rel.table] as Row[]).find((t) => t.id === fkVal);
        if (!target) {
          enriched[rel.alias] = null;
          continue;
        }
        if (rel.fields.length === 1 && rel.fields[0] === '*') {
          enriched[rel.alias] = target;
        } else {
          const sub: Row = {};
          for (const f of rel.fields) sub[f] = target[f];
          enriched[rel.alias] = sub;
        }
      }
      return enriched as U;
    });
  }

  private async run(): Promise<{ data: unknown; error: null; count?: number | null }> {
    if (this.mode === 'select') {
      let out = this.rowsRef.filter((r) => this.match(r));
      if (this.orderCol) {
        const c = this.orderCol;
        const a = this.orderAsc ? 1 : -1;
        out = [...out].sort((x, y) => {
          const xv = (x as Row)[c];
          const yv = (y as Row)[c];
          if (xv == null && yv == null) return 0;
          if (xv == null) return a;
          if (yv == null) return -a;
          return String(xv) > String(yv) ? a : String(xv) < String(yv) ? -a : 0;
        });
      }
      if (this.limitN !== null) out = out.slice(0, this.limitN);
      out = this.embedRelations(out);
      const count = this.countMode ? out.length : undefined;
      if (this.headOnly) return { data: null, error: null, count };
      if (this.wantSingle) {
        return { data: out[0] ?? null, error: null, count };
      }
      if (this.wantMaybeSingle) {
        return { data: out[0] ?? null, error: null, count };
      }
      return { data: out, error: null, count };
    }
    if (this.mode === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted: T[] = [];
      for (const item of items) {
        const row = { ...item } as T;
        if (row.id == null) {
          const ids = this.rowsRef.map((r) => Number(r.id ?? 0));
          row.id = (ids.length ? Math.max(...ids) : 0) + 1;
        }
        this.rowsRef.push(row);
        inserted.push(row);
      }
      if (this.wantSingle) return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }
    if (this.mode === 'update') {
      const out: Row[] = [];
      for (const r of this.rowsRef) {
        if (this.match(r)) {
          Object.assign(r, this.updatePayload ?? {});
          out.push(r);
        }
      }
      return { data: out, error: null };
    }
    if (this.mode === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const result: T[] = [];
      const conflictCol = this.upsertOnConflict ?? 'id';
      for (const item of items) {
        const idx = this.rowsRef.findIndex((r) => (r as Row)[conflictCol] === (item as Row)[conflictCol]);
        if (idx >= 0) {
          this.rowsRef[idx] = { ...this.rowsRef[idx], ...item } as T;
          result.push(this.rowsRef[idx]!);
        } else {
          const row = { ...item } as T;
          if (row.id == null) {
            const ids = this.rowsRef.map((r) => Number(r.id ?? 0));
            row.id = (ids.length ? Math.max(...ids) : 0) + 1;
          }
          this.rowsRef.push(row);
          result.push(row);
        }
      }
      return { data: result, error: null };
    }
    if (this.mode === 'delete') {
      let i = 0;
      while (i < this.rowsRef.length) {
        if (this.match(this.rowsRef[i] as Row)) {
          this.rowsRef.splice(i, 1);
        } else {
          i++;
        }
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };

export type FakeDb = {
  profiles: Profile[];
  contacts: Contact[];
  events: Event[];
  outreach: Outreach[];
};

export function makeFakeSupabase(opts: {
  authUser?: AuthUser | null;
  db?: Partial<FakeDb>;
}) {
  const db: FakeDb = {
    profiles: [...(opts.db?.profiles ?? [])],
    contacts: [...(opts.db?.contacts ?? [])],
    events: [...(opts.db?.events ?? [])],
    outreach: [...(opts.db?.outreach ?? [])],
  };

  const user = opts.authUser ?? null;

  const client = {
    auth: {
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      admin: {
        listUsers: () => Promise.resolve({ data: { users: [] }, error: null }),
        createUser: (args: { email: string; password: string; user_metadata?: Record<string, unknown> }) => {
          const id = crypto.randomUUID();
          // Simulate the trigger that inserts into profiles
          db.profiles.push({
            id,
            email: args.email,
            name: (args.user_metadata?.name as string) ?? args.email.split('@')[0]!,
            role: (args.user_metadata?.role as string) ?? 'Member',
            created_at: new Date().toISOString(),
          });
          return Promise.resolve({ data: { user: { id, email: args.email } }, error: null });
        },
      },
    },
    from: (table: keyof FakeDb) => new QueryBuilder(db[table] as Row[], table, db),
    _db: db,
  };

  return client;
}

export type FakeSupabase = ReturnType<typeof makeFakeSupabase>;
