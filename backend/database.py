"""
Database layer — PostgreSQL in production, SQLite locally.
Picks based on DATABASE_URL env var.
"""
import os
import sqlite3
from datetime import datetime
from contextlib import contextmanager

DATABASE_URL = os.getenv('DATABASE_URL', '')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

IS_POSTGRES = bool(DATABASE_URL)
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'outreach.db')


@contextmanager
def get_conn():
    if IS_POSTGRES:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def _rows(cur):
    if IS_POSTGRES:
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    return [dict(r) for r in cur.fetchall()]


def _row(cur):
    if IS_POSTGRES:
        r = cur.fetchone()
        if r is None:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, r))
    r = cur.fetchone()
    return dict(r) if r else None


def _p(sql):
    """Swap ? → %s for postgres."""
    return sql.replace('?', '%s') if IS_POSTGRES else sql


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

def init_db():
    with get_conn() as conn:
        c = conn.cursor()
        serial = 'SERIAL' if IS_POSTGRES else 'INTEGER'
        ts     = 'TIMESTAMP DEFAULT NOW()' if IS_POSTGRES else "TEXT DEFAULT (datetime('now'))"
        auto   = '' if IS_POSTGRES else 'AUTOINCREMENT'

        c.execute(f'''
            CREATE TABLE IF NOT EXISTS users (
                id {serial} PRIMARY KEY {auto},
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT DEFAULT 'Member',
                password_hash TEXT NOT NULL,
                created_at {ts}
            )
        ''')

        c.execute(f'''
            CREATE TABLE IF NOT EXISTS events (
                id {serial} PRIMARY KEY {auto},
                name TEXT NOT NULL,
                date TEXT,
                description TEXT,
                what_we_need TEXT,
                created_by INTEGER,
                created_at {ts}
            )
        ''')

        c.execute(f'''
            CREATE TABLE IF NOT EXISTS contacts (
                id {serial} PRIMARY KEY {auto},
                name TEXT NOT NULL,
                email TEXT,
                company TEXT,
                title TEXT,
                linkedin_url TEXT,
                website TEXT,
                description TEXT,
                industry TEXT,
                location TEXT,
                added_at {ts},
                source TEXT
            )
        ''')

        c.execute(f'''
            CREATE TABLE IF NOT EXISTS outreach (
                id {serial} PRIMARY KEY {auto},
                contact_id INTEGER NOT NULL,
                event_id INTEGER,
                user_id INTEGER,
                channel TEXT NOT NULL DEFAULT 'email',
                status TEXT NOT NULL DEFAULT 'draft',
                subject TEXT,
                body TEXT,
                sent_at TEXT
            )
        ''')

        c.execute('CREATE INDEX IF NOT EXISTS idx_outreach_contact ON outreach(contact_id, channel)')

        # Migrate existing outreach table — add columns that older schema didn't have
        for col, definition in [('user_id', 'INTEGER'), ('event_id', 'INTEGER'), ('sent_at', 'TEXT')]:
            try:
                c.execute(f'ALTER TABLE outreach ADD COLUMN {col} {definition}')
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def create_user(name, email, role, password_hash):
    with get_conn() as conn:
        c = conn.cursor()
        if IS_POSTGRES:
            c.execute('INSERT INTO users (name,email,role,password_hash) VALUES (%s,%s,%s,%s) RETURNING id',
                      (name, email, role, password_hash))
            return _row(c)['id']
        else:
            c.execute('INSERT INTO users (name,email,role,password_hash) VALUES (?,?,?,?)',
                      (name, email, role, password_hash))
            return c.lastrowid


def get_user_by_email(email):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('SELECT * FROM users WHERE LOWER(email)=LOWER(?)'), (email,))
        return _row(c)


def get_user_by_id(user_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('SELECT * FROM users WHERE id=?'), (user_id,))
        return _row(c)


def get_all_users():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('SELECT id,name,email,role,created_at FROM users ORDER BY created_at')
        return _rows(c)


def user_count():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('SELECT COUNT(*) as n FROM users')
        return _row(c)['n']


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

def create_event(name, date, description, what_we_need, user_id):
    with get_conn() as conn:
        c = conn.cursor()
        if IS_POSTGRES:
            c.execute('''INSERT INTO events (name,date,description,what_we_need,created_by)
                         VALUES (%s,%s,%s,%s,%s) RETURNING id''',
                      (name, date, description, what_we_need, user_id))
            return _row(c)['id']
        else:
            c.execute('INSERT INTO events (name,date,description,what_we_need,created_by) VALUES (?,?,?,?,?)',
                      (name, date, description, what_we_need, user_id))
            return c.lastrowid


def get_all_events():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM events ORDER BY created_at DESC')
        return _rows(c)


def get_event(event_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('SELECT * FROM events WHERE id=?'), (event_id,))
        return _row(c)


def delete_event(event_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('DELETE FROM events WHERE id=?'), (event_id,))


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

def email_exists(email):
    if not email:
        return False
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('SELECT id FROM contacts WHERE LOWER(email)=LOWER(?)'), (email,))
        return _row(c) is not None


def add_contact(data):
    with get_conn() as conn:
        c = conn.cursor()
        fields = ('name','email','company','title','linkedin_url','website','description','industry','location','source')
        vals   = tuple(data.get(f,'') for f in fields)
        if IS_POSTGRES:
            c.execute(f"INSERT INTO contacts ({','.join(fields)}) VALUES ({','.join(['%s']*len(fields))}) RETURNING id", vals)
            return _row(c)['id']
        else:
            c.execute(f"INSERT INTO contacts ({','.join(fields)}) VALUES ({','.join(['?']*len(fields))})", vals)
            return c.lastrowid


def get_all_contacts():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('''
            SELECT c.*,
                MAX(CASE WHEN o.status='sent' THEN o.sent_at END) as last_sent,
                COUNT(CASE WHEN o.status='sent' THEN 1 END) as times_contacted
            FROM contacts c
            LEFT JOIN outreach o ON o.contact_id=c.id
            GROUP BY c.id ORDER BY c.added_at DESC
        ''')
        return _rows(c)


def delete_contact(contact_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('DELETE FROM outreach WHERE contact_id=?'), (contact_id,))
        c.execute(_p('DELETE FROM contacts WHERE id=?'), (contact_id,))


# ---------------------------------------------------------------------------
# Outreach / Drafts
# ---------------------------------------------------------------------------

def already_contacted(contact_id, channel='email'):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("SELECT id FROM outreach WHERE contact_id=? AND channel=? AND status='sent'"), (contact_id, channel))
        return _row(c) is not None


def contact_has_draft(contact_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("SELECT id FROM outreach WHERE contact_id=? AND status='draft'"), (contact_id,))
        return _row(c) is not None


def save_draft(contact_id, subject, body, user_id=None, event_id=None):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("DELETE FROM outreach WHERE contact_id=? AND status='draft'"), (contact_id,))
        if IS_POSTGRES:
            c.execute('''INSERT INTO outreach (contact_id,event_id,user_id,channel,status,subject,body)
                         VALUES (%s,%s,%s,'email','draft',%s,%s) RETURNING id''',
                      (contact_id, event_id, user_id, subject, body))
            return _row(c)['id']
        else:
            c.execute("INSERT INTO outreach (contact_id,event_id,user_id,channel,status,subject,body) VALUES (?,?,?,'email','draft',?,?)",
                      (contact_id, event_id, user_id, subject, body))
            return c.lastrowid


def update_draft(outreach_id, subject, body):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("UPDATE outreach SET subject=?,body=? WHERE id=? AND status='draft'"), (subject, body, outreach_id))


def delete_draft(outreach_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("DELETE FROM outreach WHERE id=? AND status='draft'"), (outreach_id,))


def mark_sent(outreach_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("UPDATE outreach SET status='sent',sent_at=? WHERE id=?"), (datetime.utcnow().isoformat(), outreach_id))


def mark_skipped(contact_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p("DELETE FROM outreach WHERE contact_id=? AND status='draft'"), (contact_id,))
        c.execute(_p("INSERT INTO outreach (contact_id,channel,status) VALUES (?,'email','skipped')"), (contact_id,))


def get_queue():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('''
            SELECT c.*,o.id as outreach_id,o.subject,o.body,o.event_id,o.user_id,
                   e.name as event_name
            FROM contacts c
            JOIN outreach o ON o.contact_id=c.id AND o.status='draft'
            LEFT JOIN events e ON e.id=o.event_id
            WHERE c.id NOT IN (SELECT contact_id FROM outreach WHERE status='sent')
            ORDER BY o.id DESC
        '''))
        return _rows(c)


def get_outreach_row(outreach_id):
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(_p('''
            SELECT o.*,ct.email as to_email,ct.name as to_name
            FROM outreach o JOIN contacts ct ON ct.id=o.contact_id
            WHERE o.id=? AND o.status='draft'
        '''), (outreach_id,))
        return _row(c)


def get_stats():
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('SELECT COUNT(*) as n FROM contacts');             total  = _row(c)['n']
        c.execute("SELECT COUNT(*) as n FROM outreach WHERE status='sent'");   sent   = _row(c)['n']
        c.execute("SELECT COUNT(*) as n FROM outreach WHERE status='draft'");  drafts = _row(c)['n']
        today = datetime.utcnow().date().isoformat()
        if IS_POSTGRES:
            c.execute("SELECT COUNT(*) as n FROM outreach WHERE status='sent' AND sent_at::date=CURRENT_DATE")
        else:
            c.execute(_p("SELECT COUNT(*) as n FROM outreach WHERE status='sent' AND sent_at LIKE ?"), (f'{today}%',))
        today_n = _row(c)['n']
    return {'total_contacts': total, 'emails_sent': sent, 'pending_drafts': drafts, 'sent_today': today_n}
