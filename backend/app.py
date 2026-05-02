import os
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from database import (
    init_db, add_contact, save_draft, update_draft, delete_draft, mark_sent,
    mark_skipped, get_queue, get_all_contacts, get_stats, already_contacted,
    email_exists, contact_has_draft, get_outreach_row, delete_contact,
    create_event, get_all_events, get_event, delete_event,
    create_user, get_user_by_email, get_all_users
)
from drafter import draft_email, redraft_email, test_connection
from sender import send_email, is_email_configured
from scraper import parse_csv, fetch_yc_companies, google_linkedin_search
from auth import login_required, current_user, hash_password, verify_password, ensure_default_user, SECRET_KEY

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR)
app.secret_key = SECRET_KEY
CORS(app, supports_credentials=True)

init_db()
ensure_default_user()


# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/login')
def login_page():
    return send_from_directory(FRONTEND_DIR, 'login.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user = get_user_by_email(data.get('email', ''))
    if not user or not verify_password(data.get('password', ''), user['password_hash']):
        return jsonify({'error': 'Incorrect email or password'}), 401
    session['user_id'] = user['id']
    return jsonify({'ok': True, 'name': user['name'], 'role': user['role']})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/me')
def api_me():
    user = current_user()
    if not user:
        return jsonify({'logged_in': False})
    return jsonify({'logged_in': True, 'id': user['id'], 'name': user['name'],
                    'email': user['email'], 'role': user['role']})


# ---------------------------------------------------------------------------
# Team (user management)
# ---------------------------------------------------------------------------

@app.route('/api/users')
@login_required
def api_users():
    return jsonify(get_all_users())

@app.route('/api/users', methods=['POST'])
@login_required
def api_create_user():
    data = request.json or {}
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400
    if get_user_by_email(data['email']):
        return jsonify({'error': 'Email already registered'}), 409
    uid = create_user(
        data.get('name', ''),
        data['email'],
        data.get('role', 'Member'),
        hash_password(data['password'])
    )
    return jsonify({'id': uid}), 201


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

@app.route('/api/events')
@login_required
def api_events():
    return jsonify(get_all_events())

@app.route('/api/events', methods=['POST'])
@login_required
def api_create_event():
    data = request.json or {}
    if not data.get('name'):
        return jsonify({'error': 'Event name required'}), 400
    user = current_user()
    eid = create_event(
        data['name'],
        data.get('date', ''),
        data.get('description', ''),
        data.get('what_we_need', ''),
        user['id']
    )
    return jsonify({'id': eid}), 201

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
@login_required
def api_delete_event(event_id):
    delete_event(event_id)
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.route('/api/stats')
@login_required
def api_stats():
    stats = get_stats()
    stats['email_configured'] = is_email_configured()
    backend = test_connection()
    stats['ai_backend'] = backend.get('active_backend', 'template')
    return jsonify(stats)


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

@app.route('/api/contacts')
@login_required
def api_contacts():
    return jsonify(get_all_contacts())

@app.route('/api/contacts', methods=['POST'])
@login_required
def api_add_contact():
    data = request.json or {}
    if not data.get('name') and not data.get('email'):
        return jsonify({'error': 'Need at least a name or email'}), 400
    if data.get('email') and email_exists(data['email']):
        return jsonify({'error': 'Contact with this email already exists'}), 409
    return jsonify({'id': add_contact(data)}), 201

@app.route('/api/contacts/<int:contact_id>', methods=['DELETE'])
@login_required
def api_delete_contact(contact_id):
    delete_contact(contact_id)
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# CSV Import
# ---------------------------------------------------------------------------

@app.route('/api/import/csv', methods=['POST'])
@login_required
def api_import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    contacts = parse_csv(request.files['file'].read())
    added, skipped = 0, 0
    for c in contacts:
        if c.get('email') and email_exists(c['email']):
            skipped += 1
        else:
            add_contact(c)
            added += 1
    return jsonify({'added': added, 'skipped_duplicates': skipped, 'total_in_file': len(contacts)})


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

@app.route('/api/discover/yc')
@login_required
def api_discover_yc():
    return jsonify(fetch_yc_companies(
        batch=request.args.get('batch',''),
        industry=request.args.get('industry',''),
        limit=int(request.args.get('limit', 30))
    ))

@app.route('/api/discover/search')
@login_required
def api_discover_search():
    q = request.args.get('q', '')
    if not q:
        return jsonify({'error': 'q required'}), 400
    return jsonify(google_linkedin_search(q, max_results=int(request.args.get('limit', 10))))


# ---------------------------------------------------------------------------
# Queue & Drafts
# ---------------------------------------------------------------------------

@app.route('/api/queue')
@login_required
def api_queue():
    return jsonify(get_queue())

@app.route('/api/draft/<int:contact_id>', methods=['POST'])
@login_required
def api_generate_draft(contact_id):
    contacts = get_all_contacts()
    contact  = next((c for c in contacts if c['id'] == contact_id), None)
    if not contact:
        return jsonify({'error': 'Contact not found'}), 404
    if already_contacted(contact_id):
        return jsonify({'error': 'Already sent to this contact'}), 409

    user  = current_user()
    data  = request.json or {}
    event = get_event(data['event_id']) if data.get('event_id') else None
    sender = {'name': user['name'], 'role': user['role']} if user else {}

    feedback     = data.get('feedback')
    current_body = data.get('current_body')

    if feedback and current_body:
        result = redraft_email(contact, feedback, current_body, sender=sender)
    else:
        result = draft_email(contact, event=event, sender=sender)

    eid = data.get('event_id')
    uid = user['id'] if user else None
    outreach_id = save_draft(contact_id, result['subject'], result['body'], user_id=uid, event_id=eid)
    return jsonify({'outreach_id': outreach_id, **result})

@app.route('/api/draft/<int:outreach_id>', methods=['PUT'])
@login_required
def api_update_draft(outreach_id):
    data = request.json or {}
    update_draft(outreach_id, data.get('subject',''), data.get('body',''))
    return jsonify({'ok': True})

@app.route('/api/draft/<int:outreach_id>', methods=['DELETE'])
@login_required
def api_delete_draft(outreach_id):
    delete_draft(outreach_id)
    return jsonify({'ok': True})

@app.route('/api/draft/bulk', methods=['POST'])
@login_required
def api_bulk_draft():
    user   = current_user()
    data   = request.json or {}
    event  = get_event(data['event_id']) if data.get('event_id') else None
    sender = {'name': user['name'], 'role': user['role']} if user else {}

    contacts = get_all_contacts()
    generated, errors = 0, []
    for contact in contacts:
        if already_contacted(contact['id']) or contact_has_draft(contact['id']):
            continue
        try:
            result = draft_email(contact, event=event, sender=sender)
            uid = user['id'] if user else None
            eid = data.get('event_id')
            save_draft(contact['id'], result['subject'], result['body'], user_id=uid, event_id=eid)
            generated += 1
        except Exception as e:
            errors.append({'contact_id': contact['id'], 'name': contact.get('name',''), 'error': str(e)})
    return jsonify({'generated': generated, 'errors': errors})

@app.route('/api/send/<int:outreach_id>', methods=['POST'])
@login_required
def api_send(outreach_id):
    row = get_outreach_row(outreach_id)
    if not row:
        return jsonify({'error': 'Draft not found'}), 404
    if not row.get('to_email'):
        return jsonify({'error': 'Contact has no email address — add one in Contacts first'}), 400
    try:
        send_email(row['to_email'], row['subject'], row['body'], to_name=row.get('to_name',''))
        mark_sent(outreach_id)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/skip/<int:contact_id>', methods=['POST'])
@login_required
def api_skip(contact_id):
    mark_skipped(contact_id)
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------

@app.route('/api/test-gemini')
@login_required
def api_test_gemini():
    return jsonify(test_connection())


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    print(f'\n  SI Outreach Tool — http://localhost:{port}\n')
    app.run(debug=os.getenv('FLASK_ENV') != 'production', port=port, host='0.0.0.0')
