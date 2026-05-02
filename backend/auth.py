import os
from functools import wraps
from flask import session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from database import create_user, get_user_by_email, user_count

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Unauthorized', 'login_required': True}), 401
        return f(*args, **kwargs)
    return decorated


def current_user():
    from database import get_user_by_id
    uid = session.get('user_id')
    if not uid:
        return None
    return get_user_by_id(uid)


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password, password_hash):
    return check_password_hash(password_hash, password)


def ensure_default_user():
    """Create a default admin account on first run if no users exist."""
    if user_count() == 0:
        default_email    = os.getenv('DEFAULT_EMAIL',    'admin@siucsd.com')
        default_password = os.getenv('DEFAULT_PASSWORD', 'siucsd2026')
        default_name     = os.getenv('YOUR_NAME',        'Admin')
        default_role     = os.getenv('YOUR_ROLE',        'President')
        create_user(default_name, default_email, default_role, hash_password(default_password))
        print(f'  Default account created: {default_email} / {default_password}')
